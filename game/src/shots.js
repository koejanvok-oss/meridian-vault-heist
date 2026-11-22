// The screenshot scenes behind ?shot=cover|heist|alarm|win. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot that follows the level's shotPath, waits
// when a vision cone covers the way ahead, backs off when a guard spots
// it, and spends a smoke bomb when the alarm climbs — so the frame is what
// a real game looks like and the same seed always gives the same frame.
// The win scene retries the route a few times; if the pilot is caught
// every time, the world is set to the state a real getaway produces and
// rendered as-is.

import { STEP } from './config.js';
import { EVENT_BUSTED, EVENT_LEVEL_DONE, EVENT_WON } from './world.js';
import { SCREEN_LEVEL_DONE, SCREEN_PLAY } from './render.js';

const SAMPLE = STEP;

/** Nearest guard to the player, and how far away it is. */
function nearestGuard(state) {
  let best = null;
  let bestDist = Infinity;
  for (const guard of state.guards) {
    const dist = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = guard;
    }
  }
  return { guard: best, dist: bestDist };
}

/** A repulsion vector away from every nearby guard, blended with the goal. */
function fleeVector(state, tx, ty) {
  const player = state.player;
  let fx = 0;
  let fy = 0;
  for (const guard of state.guards) {
    const gx = player.x - guard.x;
    const gy = player.y - guard.y;
    const d = Math.hypot(gx, gy) || 1;
    if (d < 340) {
      const w = (340 - d) / 340;
      fx += (gx / d) * w;
      fy += (gy / d) * w;
    }
  }
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  let mx = fx * 0.9 + (dx / dist) * 0.6;
  let my = fy * 0.9 + (dy / dist) * 0.6;
  const len = Math.hypot(mx, my) || 1;
  return { mx: mx / len, my: my / len };
}

/** Steer toward `target`, waiting out a cone that covers the way ahead. */
function pilotInput(world, target, retreat, waitTimer) {
  const state = world.state;
  const player = state.player;
  const dx = target[0] - player.x;
  const dy = target[1] - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 14) return { mx: 0, my: 0, tool: null, decoy: null, arrived: true };
  // Spotted: slip away from every guard at once (a repulsion sum, so the
  // thief is not herded into a second patrol), drifting toward the
  // waypoint at the same time, and drop smoke if the alarm is climbing.
  if (state.spotted) {
    if (state.alarm > 35 && state.tools.smoke > 0) return { mx: 0, my: 0, tool: 'smoke', decoy: null, arrived: false };
    const flee = fleeVector(state, target[0], target[1]);
    return { mx: flee.mx, my: flee.my, tool: null, decoy: null, arrived: false };
  }
  // A guard's body is danger too, even outside its cone: walking parallel
  // to a patrol, a hair from its shoulder, is how thieves get caught.
  const { dist: nearDist } = nearestGuard(state);
  if (nearDist < 90) {
    const flee = fleeVector(state, target[0], target[1]);
    return { mx: flee.mx, my: flee.my, tool: null, decoy: null, arrived: false };
  }
  // The point a step ahead: if a cone covers it, fall back toward the last
  // waypoint instead of standing in the open — patrol lanes are where
  // waiting thieves get caught.
  const aheadX = player.x + (dx / dist) * 46;
  const aheadY = player.y + (dy / dist) * 46;
  if (world.coneDangerAt(aheadX, aheadY)) {
    if (waitTimer > 2.5 && state.tools.smoke > 0 && state.alarm > 20) {
      return { mx: 0, my: 0, tool: 'smoke', decoy: null, arrived: false };
    }
    const rx = retreat[0] - player.x;
    const ry = retreat[1] - player.y;
    const rdist = Math.hypot(rx, ry);
    if (rdist > 24) {
      return { mx: rx / rdist, my: ry / rdist, tool: null, decoy: null, arrived: false, waiting: true };
    }
    if (waitTimer > 1.2) {
      const side = Math.floor(waitTimer / 1.2) % 2 === 0 ? 1 : -1;
      return { mx: (-dy / dist) * side, my: (dx / dist) * side, tool: null, decoy: null, arrived: false, waiting: true };
    }
    return { mx: 0, my: 0, tool: null, decoy: null, arrived: false, waiting: true };
  }
  return { mx: dx / dist, my: dy / dist, tool: null, decoy: null, arrived: false };
}

/**
 * Run the pilot along a waypoint list for up to `seconds`. Returns
 * 'busted', 'done' or 'time'. `smokeAfter` spends one smoke bomb that many
 * seconds in, so the frame shows a tool in use. When the pilot is stuck
 * waiting for a cone to pass, it throws a decoy chip away from its goal:
 * the guards walk off to investigate the clink and the way clears.
 */
function runRoute(world, waypoints, seconds, smokeAfter = null) {
  let waypoint = 0;
  let waitTimer = 0;
  let waitTime = 0;
  let smoked = false;
  let decoyCooldown = 0;
  for (let t = 0; t < seconds; t += SAMPLE) {
    let tool = null;
    if (smokeAfter !== null && !smoked && t >= smokeAfter && world.state.tools.smoke > 0) {
      tool = 'smoke';
      smoked = true;
    }
    const input = pilotInput(world, waypoints[waypoint], waypoint > 0 ? waypoints[waypoint - 1] : [world.state.level.start.x, world.state.level.start.y], waitTimer);
    if (input.tool) tool = input.tool;
    if (input.arrived) {
      waypoint = Math.min(waypoint + 1, waypoints.length - 1);
      waitTimer = 0;
      waitTime = 0;
    } else if (input.waiting) {
      waitTimer += SAMPLE;
      waitTime += SAMPLE;
    } else {
      waitTimer = 0;
      waitTime = 0;
    }
    decoyCooldown -= SAMPLE;
    let decoy = null;
    if (waitTime > 1.5 && decoyCooldown <= 0 && world.state.tools.decoy > 0) {
      const state = world.state;
      const target = waypoints[waypoint];
      const awayX = state.player.x - target[0];
      const awayY = state.player.y - target[1];
      const len = Math.hypot(awayX, awayY) || 1;
      decoy = {
        x: Math.max(40, Math.min(1240, state.player.x + (awayX / len) * 280)),
        y: Math.max(90, Math.min(690, state.player.y + (awayY / len) * 280)),
      };
      decoyCooldown = 6;
      waitTime = 0;
    }
    const events = world.step(SAMPLE, { mx: input.mx, my: input.my, slow: false, tool, decoy }, false);
    if (events & EVENT_BUSTED) return 'busted';
    if (events & (EVENT_LEVEL_DONE | EVENT_WON)) return 'done';
  }
  return 'time';
}

/** Run a route, retrying from scratch when the pilot is caught. */
function runRouteWithRetries(world, waypoints, seconds, smokeAfter = null) {
  let result = 'time';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    world.resetRun();
    result = runRoute(world, waypoints, seconds, smokeAfter);
    if (result !== 'busted') return result;
  }
  return result;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'heist') {
    world.resetRun();
    world.loadLevel(1);
    const level = world.state.levelIndex;
    let result = 'time';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.resetRun();
      world.loadLevel(level);
      result = runRoute(world, world.state.level.shotPath.slice(0, 5), 11, 8);
      if (result !== 'busted') break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'alarm') {
    world.resetRun();
    // Stand east of the first guard's patrol line, off every patrol lane,
    // and hold still while the alarm climbs — backing off when a guard
    // closes in, so the frame is a lockdown about to break, not a catch.
    const stand = { x: 760, y: 560 };
    for (let t = 0; t < 20; t += SAMPLE) {
      let mx = 0;
      let my = 0;
      let nearest = null;
      let nearestDist = Infinity;
      for (const guard of state.guards) {
        const d = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = guard;
        }
      }
      const dx = stand.x - state.player.x;
      const dy = stand.y - state.player.y;
      const dist = Math.hypot(dx, dy);
      if (nearest && nearestDist < 160) {
        const ax = state.player.x - nearest.x;
        const ay = state.player.y - nearest.y;
        const len = Math.hypot(ax, ay) || 1;
        mx = ax / len;
        my = ay / len;
      } else if (dist > 10) {
        mx = dx / dist;
        my = dy / dist;
      }
      const events = world.step(SAMPLE, { mx, my, slow: false, tool: null, decoy: null }, false);
      if (events & EVENT_BUSTED) break;
      if (state.alarm >= 88) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.resetRun();
      const result = runRoute(world, world.state.level.shotPath, 120, 12);
      if (result === 'done') return { screen: SCREEN_LEVEL_DONE };
    }
    // The pilot was caught three times: stage the getaway directly from the
    // state a real win produces, so the frame still shows the real screen.
    world.resetRun();
    for (const item of state.loot) item.taken = true;
    state.mainLoot.taken = true;
    state.exitOpen = true;
    state.take = 3750;
    state.totalTake = 3750;
    state.player.x = state.level.exit.x + 20;
    state.player.y = state.level.exit.y + 28;
    state.phase = 'levelDone';
    return { screen: SCREEN_LEVEL_DONE };
  }
  // cover: the first room, mid-heist, thief deep in the floor. The smoke
  // goes off late so the cloud is still hanging in the frame.
  runRouteWithRetries(world, world.state.level.shotPath.slice(0, 4), 14, 10);
  return { screen: SCREEN_PLAY };
}
