// The game's rules and state, with no drawing and no browser in it: the
// thief, the guards and their patrols, the sweeping cameras, the alarm
// meter, the three tools, the loot and the exit. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// (sounds, screens) without the world knowing about them. Nothing here
// allocates after createWorld returns.

import { ALARM, ATTEMPTS, CAMERA, FIELD, GUARD, LOOT, PLAYER, TOOLS } from './config.js';
import { LEVELS } from './levels.js';
import { angleDifference, buildSegments, canSee } from './vision.js';

export const EVENT_LOOT = 1;
export const EVENT_MAIN_LOOT = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_BUSTED = 8;
export const EVENT_OVER = 16;
export const EVENT_LEVEL_DONE = 32;
export const EVENT_WON = 64;
export const EVENT_SMOKE = 128;
export const EVENT_EMP = 256;
export const EVENT_DECOY = 512;
export const EVENT_UNLOCK = 1024;

const GUARD_PATROL = 0;
const GUARD_INVESTIGATE = 1;
const GUARD_HUNT = 2;

function circleHitsSolids(x, y, radius, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

function moveCircle(entity, dx, dy, radius, solids) {
  const nx = entity.x + dx;
  if (!circleHitsSolids(nx, entity.y, radius, solids)) entity.x = nx;
  const ny = entity.y + dy;
  if (!circleHitsSolids(entity.x, ny, radius, solids)) entity.y = ny;
  entity.x = Math.max(radius, Math.min(FIELD.width - radius, entity.x));
  entity.y = Math.max(56 + radius, Math.min(FIELD.height - radius, entity.y));
}

function turnToward(current, target, maxStep) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > maxStep) return current + maxStep;
  if (d < -maxStep) return current - maxStep;
  return target;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    segments: [],
    player: { x: 0, y: 0, moving: false, stepPhase: 0 },
    guards: [],
    cameras: [],
    loot: [],
    mainLoot: { x: 0, y: 0, name: '', value: 0, taken: false },
    exitOpen: false,
    alarm: 0,
    lockdown: false,
    smokes: [],
    decoys: [],
    tools: { smoke: TOOLS.smoke.start, emp: TOOLS.emp.start, decoy: TOOLS.decoy.start },
    empTime: 0,
    take: 0,
    totalTake: 0,
    attempts: ATTEMPTS,
    phase: 'play',
    elapsed: 0,
    levelTime: 0,
    peakAlarm: 0,
    spotted: false,
    seenBy: '',
    message: '',
    messageTime: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.segments = buildSegments(level.solids);
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.moving = false;
    state.guards = level.guards.map((g) => ({
      name: g.name,
      x: g.path[0][0],
      y: g.path[0][1],
      angle: Math.atan2(g.path[1][1] - g.path[0][1], g.path[1][0] - g.path[0][0]),
      path: g.path,
      waypoint: 1,
      pause: 0,
      speed: g.speed,
      mode: GUARD_PATROL,
      targetX: g.path[0][0],
      targetY: g.path[0][1],
      lookTimer: 0,
      memory: 0,
      scanAngle: 0,
    }));
    state.cameras = level.cameras.map((c, i) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.angle,
      angle: c.angle,
      phase: (i * 1.7) % 1,
      disabled: false,
    }));
    state.loot = level.loot.map((l) => ({ x: l.x, y: l.y, value: l.value, taken: false }));
    state.mainLoot = { x: level.mainLoot.x, y: level.mainLoot.y, name: level.mainLoot.name, value: level.mainLoot.value, taken: false };
    state.exitOpen = false;
    state.alarm = 0;
    state.lockdown = false;
    state.smokes = [];
    state.decoys = [];
    state.tools = { smoke: TOOLS.smoke.start, emp: TOOLS.emp.start, decoy: TOOLS.decoy.start };
    state.empTime = 0;
    state.take = 0;
    state.levelTime = 0;
    state.peakAlarm = 0;
    state.spotted = false;
    state.message = '';
    state.messageTime = 0;
  }

  function resetRun() {
    state.totalTake = 0;
    state.attempts = ATTEMPTS;
    state.elapsed = 0;
    state.phase = 'play';
    loadLevel(0);
  }

  function bust() {
    state.attempts -= 1;
    state.phase = 'busted';
    if (state.attempts <= 0) {
      state.phase = 'over';
      return EVENT_BUSTED | EVENT_OVER;
    }
    return EVENT_BUSTED;
  }

  /** Is the point inside any live vision cone (guard or camera)? */
  function coneDangerAt(x, y) {
    for (const guard of state.guards) {
      if (canSee(guard.x, guard.y, guard.angle, GUARD.coneHalfAngle, GUARD.coneRange, x, y, state.segments, state.smokes)) return true;
    }
    for (const camera of state.cameras) {
      if (camera.disabled) continue;
      if (canSee(camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, CAMERA.coneRange, x, y, state.segments, state.smokes)) return true;
    }
    return false;
  }

  /**
   * One fixed step. `input` carries the move vector (-1..1 each axis), the
   * tool the player just used (or null) and a decoy target (or null).
   * `harmless` is the title screen's backdrop: the world idles, nothing
   * spots the thief and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.phase !== 'play') return events;
    state.levelTime += dt;

    const player = state.player;
    const solids = state.level.solids;

    // --- Tools -------------------------------------------------------------
    if (!harmless && input.tool === 'smoke' && state.tools.smoke > 0) {
      state.tools.smoke -= 1;
      state.smokes.push({ x: player.x, y: player.y, radius: TOOLS.smoke.radius, time: TOOLS.smoke.seconds });
      events |= EVENT_SMOKE;
    }
    if (!harmless && input.tool === 'emp' && state.tools.emp > 0) {
      state.tools.emp -= 1;
      state.empTime = TOOLS.emp.seconds;
      for (const camera of state.cameras) camera.disabled = true;
      events |= EVENT_EMP;
    }
    if (!harmless && input.decoy && state.tools.decoy > 0) {
      const dx = input.decoy.x - player.x;
      const dy = input.decoy.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 10 && dist <= PLAYER.decoyRange) {
        // Nudge the landing spot out of any solid, so a guard sent to
        // investigate it can actually get there.
        let lx = input.decoy.x;
        let ly = input.decoy.y;
        for (let nudge = 0; nudge < 30 && circleHitsSolids(lx, ly, 10, solids); nudge += 1) {
          lx -= (dx / (dist || 1)) * 10;
          ly -= (dy / (dist || 1)) * 10;
        }
        state.tools.decoy -= 1;
        state.decoys.push({ x: lx, y: ly, time: 6 });
        for (const guard of state.guards) {
          if (guard.mode !== GUARD_HUNT) {
            guard.mode = GUARD_INVESTIGATE;
            guard.targetX = lx;
            guard.targetY = ly;
            guard.lookTimer = 0;
          }
        }
        events |= EVENT_DECOY;
      }
    }

    // --- Move the thief ----------------------------------------------------
    const speed = PLAYER.speed * (input.slow ? 0.55 : 1);
    const mx = input.mx;
    const my = input.my;
    const mag = Math.hypot(mx, my);
    player.moving = mag > 0.01;
    if (player.moving) {
      const nx = (mx / (mag || 1)) * speed * dt;
      const ny = (my / (mag || 1)) * speed * dt;
      moveCircle(player, nx, ny, PLAYER.radius, solids);
      player.stepPhase += dt * 9;
    }

    // --- Timers: smoke, decoys, EMP ----------------------------------------
    for (let i = state.smokes.length - 1; i >= 0; i -= 1) {
      state.smokes[i].time -= dt;
      if (state.smokes[i].time <= 0) state.smokes.splice(i, 1);
    }
    for (let i = state.decoys.length - 1; i >= 0; i -= 1) {
      state.decoys[i].time -= dt;
      if (state.decoys[i].time <= 0) state.decoys.splice(i, 1);
    }
    if (state.empTime > 0) {
      state.empTime -= dt;
      if (state.empTime <= 0) {
        for (const camera of state.cameras) camera.disabled = false;
      }
    }
    if (state.messageTime > 0) state.messageTime -= dt;

    // --- Cameras sweep ------------------------------------------------------
    for (const camera of state.cameras) {
      if (camera.disabled) continue;
      const t = state.elapsed / CAMERA.sweepPeriod + camera.phase;
      camera.angle = camera.baseAngle + Math.sin(t * Math.PI * 2) * CAMERA.sweepHalfArc;
    }

    // --- Who can see the thief? ---------------------------------------------
    let seenByGuard = null;
    let seenByCamera = false;
    if (!harmless) {
      for (const guard of state.guards) {
        if (canSee(guard.x, guard.y, guard.angle, GUARD.coneHalfAngle, GUARD.coneRange, player.x, player.y, state.segments, state.smokes)) {
          seenByGuard = guard;
          break;
        }
      }
      if (!seenByGuard) {
        for (const camera of state.cameras) {
          if (camera.disabled) continue;
          if (canSee(camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, CAMERA.coneRange, player.x, player.y, state.segments, state.smokes)) {
            seenByCamera = true;
            break;
          }
        }
      }
    }
    const wasSpotted = state.spotted;
    state.spotted = seenByGuard !== null || seenByCamera;
    state.seenBy = seenByGuard ? seenByGuard.name : seenByCamera ? 'Camera' : '';
    if (state.spotted && !wasSpotted) events |= EVENT_SPOTTED;

    // --- Alarm meter --------------------------------------------------------
    if (!harmless) {
      if (seenByGuard) {
        const dist = Math.hypot(player.x - seenByGuard.x, player.y - seenByGuard.y);
        const closeness = 1.6 - (dist / GUARD.coneRange) * 0.9;
        state.alarm += ALARM.guardRate * closeness * dt;
      } else if (seenByCamera) {
        state.alarm += ALARM.cameraRate * dt;
      } else if (state.lockdown) {
        state.alarm -= ALARM.huntDecayRate * dt;
      } else {
        state.alarm -= ALARM.decayRate * dt;
      }
      state.alarm = Math.max(0, Math.min(100, state.alarm));
      if (state.alarm > state.peakAlarm) state.peakAlarm = state.alarm;
      if (!state.lockdown && state.alarm >= ALARM.lockdown) {
        state.lockdown = true;
        state.message = 'LOCKDOWN! The guards are hunting you!';
        state.messageTime = 2.5;
        for (const guard of state.guards) {
          guard.mode = GUARD_HUNT;
          guard.targetX = player.x;
          guard.targetY = player.y;
          guard.memory = GUARD.huntMemory;
        }
      } else if (state.lockdown && state.alarm <= ALARM.calmBelow) {
        state.lockdown = false;
        state.message = 'The heat dies down… for now.';
        state.messageTime = 2.5;
        for (const guard of state.guards) {
          if (guard.mode === GUARD_HUNT) {
            guard.mode = GUARD_INVESTIGATE;
            guard.targetX = player.x;
            guard.targetY = player.y;
            guard.lookTimer = 0;
          }
        }
      }
    }

    // --- Guards --------------------------------------------------------------
    for (const guard of state.guards) {
      if (guard.mode === GUARD_HUNT) {
        if (seenByGuard === guard) {
          guard.targetX = player.x;
          guard.targetY = player.y;
          guard.memory = GUARD.huntMemory;
        } else {
          guard.memory -= dt;
          if (guard.memory <= 0) {
            guard.mode = GUARD_INVESTIGATE;
            guard.lookTimer = 0;
          }
        }
        const dx = guard.targetX - guard.x;
        const dy = guard.targetY - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          const want = Math.atan2(dy, dx);
          guard.angle = turnToward(guard.angle, want, dt * 7);
          moveCircle(guard, (dx / dist) * GUARD.huntSpeed * dt, (dy / dist) * GUARD.huntSpeed * dt, GUARD.radius, solids);
        }
      } else if (guard.mode === GUARD_INVESTIGATE) {
        const dx = guard.targetX - guard.x;
        const dy = guard.targetY - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          const want = Math.atan2(dy, dx);
          guard.angle = turnToward(guard.angle, want, dt * 7);
          moveCircle(guard, (dx / dist) * GUARD.investigateSpeed * dt, (dy / dist) * GUARD.investigateSpeed * dt, GUARD.radius, solids);
        } else {
          guard.lookTimer += dt;
          guard.angle += dt * 2.2;
          if (guard.lookTimer > GUARD.investigateTime) {
            guard.mode = GUARD_PATROL;
            guard.pause = 0;
          }
        }
      } else {
        if (guard.pause > 0) {
          guard.pause -= dt;
          guard.angle += dt * 0.6;
        } else {
          const wp = guard.path[guard.waypoint];
          const dx = wp[0] - guard.x;
          const dy = wp[1] - guard.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 6) {
            guard.waypoint = (guard.waypoint + 1) % guard.path.length;
            guard.pause = GUARD.waypointPause;
          } else {
            const want = Math.atan2(dy, dx);
            guard.angle = turnToward(guard.angle, want, dt * 7);
            moveCircle(guard, (dx / dist) * guard.speed * dt, (dy / dist) * guard.speed * dt, GUARD.radius, solids);
          }
        }
      }
      // A guard that spots the thief reacts in proportion: up close it
      // charges, at a distance it walks over to look — the alarm meter, not
      // one glimpse, is what brings the whole house down on you.
      if (seenByGuard === guard) {
        const dx = player.x - guard.x;
        const dy = player.y - guard.y;
        const dist = Math.hypot(dx, dy);
        if (guard.mode === GUARD_PATROL) {
          guard.targetX = player.x;
          guard.targetY = player.y;
          if (dist < 110) {
            guard.mode = GUARD_HUNT;
            guard.memory = GUARD.huntMemory;
          } else {
            guard.mode = GUARD_INVESTIGATE;
            guard.lookTimer = 0;
          }
        } else if (guard.mode === GUARD_INVESTIGATE) {
          guard.targetX = player.x;
          guard.targetY = player.y;
          guard.lookTimer = 0;
        }
      }
      // Caught: a guard's hands on the thief, in any mode.
      if (!harmless) {
        const dx = player.x - guard.x;
        const dy = player.y - guard.y;
        if (dx * dx + dy * dy < (PLAYER.radius + GUARD.radius - 2) * (PLAYER.radius + GUARD.radius - 2)) {
          return events | bust();
        }
      }
    }

    // --- Loot -----------------------------------------------------------------
    if (!harmless) {
      for (const item of state.loot) {
        if (item.taken) continue;
        const dx = player.x - item.x;
        const dy = player.y - item.y;
        if (dx * dx + dy * dy < LOOT.pickupRadius * LOOT.pickupRadius) {
          item.taken = true;
          state.take += item.value;
          events |= EVENT_LOOT;
        }
      }
      const main = state.mainLoot;
      if (!main.taken) {
        const dx = player.x - main.x;
        const dy = player.y - main.y;
        if (dx * dx + dy * dy < LOOT.pickupRadius * LOOT.pickupRadius) {
          main.taken = true;
          state.take += main.value;
          state.exitOpen = true;
          state.message = `${main.name} secured! Get to the exit!`;
          state.messageTime = 3;
          events |= EVENT_MAIN_LOOT | EVENT_UNLOCK;
        }
      }
    }

    // --- Exit -------------------------------------------------------------------
    if (!harmless && state.exitOpen) {
      const e = state.level.exit;
      if (player.x > e.x && player.x < e.x + e.w && player.y > e.y && player.y < e.y + e.h) {
        state.totalTake += state.take;
        if (state.levelIndex >= LEVELS.length - 1) {
          state.phase = 'won';
          return events | EVENT_LEVEL_DONE | EVENT_WON;
        }
        state.phase = 'levelDone';
        return events | EVENT_LEVEL_DONE;
      }
    }
    return events;
  }

  resetRun();
  return { state, resetRun, loadLevel, step, coneDangerAt };
}
