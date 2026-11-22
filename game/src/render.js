// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The look
// is a night casino: deep green carpet with a brass diamond lattice, lit
// slot machines, green felt tables, a steel vault. Safe cover is dark green
// and brass; danger is amber cones and the red alarm; loot is gold, so the
// eye knows at a glance what is safe, what sees you and what pays.

import { CAMERA, FIELD, FONT, GUARD, PALETTE } from './config.js';
import { LEVELS } from './levels.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_LEVEL_DONE = 'levelDone';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

/** The panel's width; its height grows with its lines. */
const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const takeLabel = cachedLabel('TAKE $');
  const totalLabel = cachedLabel('TOTAL $');
  const bestLabel = cachedLabel('Best take $');
  const timeLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** Screen pixels (a mouse click) back to field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
      y: (clientY - rect.top - view.y / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
    };
  }

  function drawCarpet() {
    context.fillStyle = PALETTE.carpet;
    context.fillRect(0, 56, FIELD.width, FIELD.height - 56);
    context.strokeStyle = PALETTE.carpetLine;
    context.lineWidth = 1;
    for (let x = -720; x < FIELD.width + 720; x += 72) {
      context.beginPath();
      context.moveTo(x, 56);
      context.lineTo(x + 664, FIELD.height);
      context.stroke();
      context.beginPath();
      context.moveTo(x + 664, 56);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    context.fillStyle = PALETTE.carpetDark;
    for (let x = 72; x < FIELD.width; x += 144) {
      for (let y = 128; y < FIELD.height; y += 144) {
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawMarble() {
    context.fillStyle = PALETTE.marble;
    context.fillRect(0, 56, FIELD.width, FIELD.height - 56);
    context.strokeStyle = PALETTE.marbleLine;
    context.lineWidth = 2;
    for (let x = 0; x <= FIELD.width; x += 128) {
      context.beginPath();
      context.moveTo(x, 56);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 56; y <= FIELD.height; y += 128) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    context.strokeStyle = PALETTE.brassDim;
    context.lineWidth = 3;
    context.strokeRect(20, 76, FIELD.width - 40, FIELD.height - 96);
  }

  function drawSolid(solid, time) {
    const { x, y, w, h } = solid;
    if (solid.kind === 'wall') {
      context.fillStyle = PALETTE.wall;
      context.fillRect(x, y, w, h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(x, y, w, 4);
      return;
    }
    if (solid.kind === 'slot') {
      context.fillStyle = PALETTE.slotBody;
      context.fillRect(x, y, w, h);
      context.fillStyle = PALETTE.machineScreen;
      context.fillRect(x + 8, y + 8, w - 16, 22);
      context.fillStyle = PALETTE.slotLight;
      const lit = Math.floor(time * 2 + x) % 3 === 0;
      context.fillRect(x + 10, y + 38, 18, 12);
      context.fillRect(x + w / 2 - 9, y + 38, 18, 12);
      context.fillRect(x + w - 28, y + 38, 18, 12);
      if (lit) {
        context.fillStyle = 'rgba(255, 220, 120, 0.8)';
        context.fillRect(x + 10, y + 38, 18, 12);
      }
      context.strokeStyle = PALETTE.brass;
      context.lineWidth = 2;
      context.strokeRect(x + 1, y + 1, w - 2, h - 2);
      return;
    }
    if (solid.kind === 'table') {
      context.fillStyle = PALETTE.feltDark;
      context.beginPath();
      context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.brass;
      context.lineWidth = 4;
      context.stroke();
      context.strokeStyle = 'rgba(242, 234, 216, 0.5)';
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(x + w / 2, y + h / 2, w / 2 - 14, h / 2 - 14, 0, 0, Math.PI * 2);
      context.stroke();
      return;
    }
    if (solid.kind === 'counter') {
      context.fillStyle = '#4a3421';
      context.fillRect(x, y, w, h);
      context.fillStyle = PALETTE.brass;
      context.fillRect(x, y, w, 6);
      context.fillStyle = 'rgba(232, 182, 76, 0.25)';
      context.fillRect(x + 8, y + 14, w - 16, h - 24);
      return;
    }
    if (solid.kind === 'cage') {
      context.fillStyle = '#1c2f22';
      context.fillRect(x, y, w, h);
      context.fillStyle = 'rgba(200, 220, 255, 0.12)';
      context.fillRect(x + 10, y + 10, w - 20, h - 20);
      context.strokeStyle = PALETTE.brass;
      context.lineWidth = 3;
      for (let bx = x + 24; bx < x + w - 10; bx += 32) {
        context.beginPath();
        context.moveTo(bx, y + 6);
        context.lineTo(bx, y + h - 6);
        context.stroke();
      }
      context.strokeRect(x + 1, y + 1, w - 2, h - 2);
      return;
    }
    if (solid.kind === 'pillar') {
      context.fillStyle = '#6e6258';
      context.fillRect(x, y, w, h);
      context.fillStyle = PALETTE.brass;
      context.fillRect(x, y, w, 5);
      context.fillRect(x, y + h - 5, w, 5);
      return;
    }
    if (solid.kind === 'vault') {
      context.fillStyle = '#3a3f46';
      context.fillRect(x, y, w, h);
      context.strokeStyle = '#565d66';
      context.lineWidth = 3;
      for (let i = 1; i < 5; i += 1) {
        context.beginPath();
        context.moveTo(x + (w / 5) * i, y);
        context.lineTo(x + (w / 5) * i, y + h);
        context.stroke();
      }
      // The round vault door, centre.
      const cx = x + w / 2;
      const cy = y + h / 2;
      context.fillStyle = '#20242a';
      context.beginPath();
      context.arc(cx, cy, 52, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.brass;
      context.lineWidth = 5;
      context.stroke();
      context.strokeStyle = '#8a8f96';
      context.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        context.beginPath();
        context.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20);
        context.lineTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48);
        context.stroke();
      }
      context.fillStyle = PALETTE.brass;
      context.beginPath();
      context.arc(cx, cy, 12, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawExit(state) {
    const e = state.level.exit;
    context.fillStyle = state.exitOpen ? PALETTE.exit : PALETTE.exitLocked;
    context.fillRect(e.x, e.y, e.w, e.h);
    if (state.exitOpen) {
      const pulse = 0.5 + 0.3 * Math.sin(state.elapsed * 5);
      context.fillStyle = `rgba(57, 217, 138, ${pulse * 0.35})`;
      context.fillRect(e.x - 8, e.y - 8, e.w + 16, e.h + 16);
    }
    context.fillStyle = state.exitOpen ? '#062b18' : '#d8d2c0';
    context.font = `bold 13px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(state.exitOpen ? 'EXIT' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2 - 4);
    context.font = `9px ${FONT}`;
    context.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2 + 12);
  }

  function drawLoot(state, time) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const bob = Math.sin(time * 3 + item.x) * 2;
      const glow = 0.25 + 0.15 * Math.sin(time * 4 + item.y);
      context.fillStyle = `rgba(255, 217, 77, ${glow})`;
      context.beginPath();
      context.arc(item.x, item.y + bob, 22, 0, Math.PI * 2);
      context.fill();
      // A stack of gold chips.
      for (let i = 0; i < 3; i += 1) {
        context.fillStyle = i % 2 ? '#d4a017' : PALETTE.loot;
        context.beginPath();
        context.ellipse(item.x, item.y + bob - i * 4, 11, 5, 0, 0, Math.PI * 2);
        context.fill();
      }
      text(`$${item.value}`, item.x, item.y + bob + 26, 11, PALETTE.loot, 'center');
    }
    const main = state.mainLoot;
    if (!main.taken) {
      const pulse = 0.3 + 0.2 * Math.sin(time * 5);
      context.fillStyle = `rgba(255, 217, 77, ${pulse})`;
      context.beginPath();
      context.arc(main.x, main.y, 34, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5a00';
      context.fillRect(main.x - 20, main.y - 14, 40, 28);
      context.fillStyle = PALETTE.loot;
      context.fillRect(main.x - 18, main.y - 12, 36, 24);
      context.fillStyle = '#7a5a00';
      context.beginPath();
      context.arc(main.x, main.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(main.x, main.y, 4, 0, Math.PI * 2);
      context.fill();
      text(main.name.toUpperCase(), main.x, main.y - 42, 12, PALETTE.loot, 'center');
      text(`$${main.value.toLocaleString('en-US')}`, main.x, main.y + 34, 12, PALETTE.loot, 'center');
    }
  }

  function drawCone(points, fill, edge) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1;
    context.stroke();
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const seeing = state.spotted && state.seenBy === guard.name;
      const points = conePolygon(guard.x, guard.y, guard.angle, GUARD.coneHalfAngle, GUARD.coneRange, state.segments);
      drawCone(points, seeing ? PALETTE.coneAlert : PALETTE.coneGuard, seeing ? 'rgba(255, 70, 50, 0.7)' : PALETTE.coneGuardEdge);
    }
    for (const camera of state.cameras) {
      if (camera.disabled) continue;
      const points = conePolygon(camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, CAMERA.coneRange, state.segments);
      drawCone(points, PALETTE.coneCamera, PALETTE.coneCameraEdge);
    }
  }

  function drawGuards(state, time) {
    for (const guard of state.guards) {
      // Body: navy uniform with a brass badge, facing its angle.
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.guardTrim;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = PALETTE.guardTrim;
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 8, guard.y + Math.sin(guard.angle) * 8, 3.5, 0, Math.PI * 2);
      context.fill();
      // Cap brim.
      context.strokeStyle = '#1a2c4a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x + Math.cos(guard.angle - 0.5) * GUARD.radius, guard.y + Math.sin(guard.angle - 0.5) * GUARD.radius);
      context.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 5), guard.y + Math.sin(guard.angle) * (GUARD.radius + 5));
      context.lineTo(guard.x + Math.cos(guard.angle + 0.5) * GUARD.radius, guard.y + Math.sin(guard.angle + 0.5) * GUARD.radius);
      context.stroke();
      // State mark: ! hunts, ? investigates, blinking when it sees you.
      if (guard.mode === 2) {
        text('!', guard.x, guard.y - GUARD.radius - 8, 20, PALETTE.danger, 'center');
      } else if (guard.mode === 1) {
        text('?', guard.x, guard.y - GUARD.radius - 8, 18, PALETTE.alarmBar, 'center');
      }
      text(guard.name, guard.x, guard.y + GUARD.radius + 14, 10, PALETTE.muted, 'center');
    }
  }

  function drawCameras(state, time) {
    for (const camera of state.cameras) {
      context.fillStyle = PALETTE.cameraBody;
      context.fillRect(camera.x - 10, camera.y - 7, 20, 14);
      context.fillStyle = camera.disabled ? '#4a4f58' : PALETTE.cameraLens;
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 10, camera.y + Math.sin(camera.angle) * 10, 4, 0, Math.PI * 2);
      context.fill();
      if (!camera.disabled && Math.floor(time * 2) % 2 === 0) {
        context.fillStyle = PALETTE.cameraLens;
        context.beginPath();
        context.arc(camera.x, camera.y - 9, 2.5, 0, Math.PI * 2);
        context.fill();
      }
      if (camera.disabled) text('OFFLINE', camera.x, camera.y + 22, 9, PALETTE.muted, 'center');
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    const bob = player.moving ? Math.sin(player.stepPhase) * 1.5 : 0;
    // Shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.ellipse(player.x, player.y + 12, 12, 5, 0, 0, Math.PI * 2);
    context.fill();
    // Burgundy suit, gold trim.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y + bob, 13, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.playerTrim;
    context.lineWidth = 2;
    context.stroke();
    // Hat: brim and crown.
    context.fillStyle = '#2a1218';
    context.beginPath();
    context.ellipse(player.x, player.y + bob - 3, 13, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(player.x, player.y + bob - 6, 6, Math.PI, 0);
    context.fill();
    context.fillStyle = PALETTE.playerTrim;
    context.fillRect(player.x - 6, player.y + bob - 8, 12, 2);
  }

  function drawSmokeAndDecoys(state, time) {
    for (const smoke of state.smokes) {
      const wobble = 1 + 0.05 * Math.sin(time * 3 + smoke.x);
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(smoke.x, smoke.y, smoke.radius * wobble, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(220, 225, 230, 0.35)';
      context.beginPath();
      context.arc(smoke.x - smoke.radius * 0.4, smoke.y - smoke.radius * 0.3, smoke.radius * 0.45, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(smoke.x + smoke.radius * 0.35, smoke.y + smoke.radius * 0.25, smoke.radius * 0.4, 0, Math.PI * 2);
      context.fill();
    }
    for (const decoy of state.decoys) {
      const ring = (time * 30) % 24;
      context.strokeStyle = `rgba(255, 217, 77, ${1 - ring / 24})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(decoy.x, decoy.y, 6 + ring, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(decoy.x, decoy.y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawAlarmVignette(state) {
    if (state.alarm < 55 && !state.lockdown) return;
    const strength = state.lockdown ? 0.5 + 0.2 * Math.sin(state.elapsed * 6) : (state.alarm - 55) / 90;
    const gradient = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
    );
    gradient.addColorStop(0, 'rgba(255, 40, 20, 0)');
    gradient.addColorStop(1, `rgba(255, 40, 20, ${strength})`);
    context.fillStyle = gradient;
    context.fillRect(0, 56, FIELD.width, FIELD.height - 56);
  }

  function drawHud(state, muted) {
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(0, 0, FIELD.width, 56);
    context.fillStyle = PALETTE.brassDim;
    context.fillRect(0, 56, FIELD.width, 2);
    context.textBaseline = 'top';
    text(takeLabel(state.take), 20, 10, 24, PALETTE.loot, 'left');
    text(totalLabel(state.totalTake), 20, 34, 13, PALETTE.muted, 'left');
    // Level name, centre.
    text(state.level.name, FIELD.width / 2, 8, 20, PALETTE.text, 'center');
    text(state.level.subtitle, FIELD.width / 2, 32, 12, PALETTE.muted, 'center');
    // Alarm meter, right of centre.
    const meterX = 830;
    const meterW = 190;
    text('ALARM', meterX, 10, 13, state.lockdown ? PALETTE.danger : PALETTE.muted, 'left');
    context.fillStyle = '#2a2118';
    context.fillRect(meterX, 28, meterW, 14);
    const alarmColor = state.alarm > 70 ? PALETTE.danger : state.alarm > 35 ? PALETTE.alarmBar : '#39d98a';
    context.fillStyle = alarmColor;
    context.fillRect(meterX, 28, meterW * (state.alarm / 100), 14);
    context.strokeStyle = PALETTE.brassDim;
    context.lineWidth = 1;
    context.strokeRect(meterX, 28, meterW, 14);
    if (state.lockdown) text('LOCKDOWN', meterX, 44, 12, PALETTE.danger, 'left');
    // Tools, far right.
    const toolX = 1060;
    text(`SMOKE ${state.tools.smoke}  [1]`, toolX, 8, 13, state.tools.smoke ? PALETTE.text : PALETTE.muted, 'left');
    text(`EMP ${state.tools.emp}  [2]`, toolX, 24, 13, state.tools.emp ? PALETTE.text : PALETTE.muted, 'left');
    text(`DECOY ${state.tools.decoy}  [click]`, toolX, 40, 13, state.tools.decoy ? PALETTE.text : PALETTE.muted, 'left');
    // Attempts as masks, bottom-left of the HUD.
    text('ATTEMPTS', 330, 10, 12, PALETTE.muted, 'left');
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < state.attempts ? PALETTE.player : '#3a2c28';
      context.beginPath();
      context.arc(352 + i * 26, 36, 8, 0, Math.PI * 2);
      context.fill();
    }
    text(timeLabel(`${Math.floor(state.levelTime / 60)}:${String(Math.floor(state.levelTime % 60)).padStart(2, '0')}`), 470, 10, 14, PALETTE.muted, 'left');
    if (muted) text('MUTED', 470, 30, 12, PALETTE.muted, 'left');
    // Spotted banner.
    if (state.spotted) {
      text(`SPOTTED by ${state.seenBy}!`, FIELD.width / 2, 66, 20, PALETTE.danger, 'center');
    } else if (state.messageTime > 0) {
      text(state.message, FIELD.width / 2, 66, 18, PALETTE.loot, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8, 10, 8, 0.82)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = '#141a12';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.brass;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.loot, 'center');
  }

  const TITLE_LINES = [
    'One thief. Three rooms. The Meridian Casino’s vault.',
    'Cross the floor, lift the prize, reach the exit — unseen.',
    'Move with WASD or arrows. Hold Shift to creep slowly.',
    '1 smoke bomb · 2 EMP pulse · 3 decoy chips (click to throw).',
    'Guards patrol with vision cones; cameras sweep the floor.',
    'When the alarm hits 100 the casino locks down and they hunt.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait. The vault will not.'];
  const BUSTED_LINES = ['', ''];
  const LEVEL_DONE_LINES = ['', '', ''];
  const OVER_LINES = ['', ''];
  const WON_LINES = ['', '', ''];

  /** Paint one frame: the floor, then the HUD or a panel for the screen. */
  function draw(state, screen, best, muted) {
    const time = state.elapsed;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (state.level.floor === 'marble') drawMarble();
    else drawCarpet();
    for (const solid of state.level.solids) drawSolid(solid, time);
    drawExit(state);
    drawLoot(state, time);
    drawCones(state);
    drawSmokeAndDecoys(state, time);
    drawGuards(state, time);
    drawCameras(state, time);
    drawPlayer(state, time);
    drawAlarmVignette(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[6] = bestLabel(best);
      drawPanel('THE MERIDIAN VAULT', TITLE_LINES, 'Press Space or click to start the heist');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      BUSTED_LINES[0] = `Caught by the house. ${state.attempts} ${state.attempts === 1 ? 'attempt' : 'attempts'} left.`;
      BUSTED_LINES[1] = `This room's take is lost. The vault keeps its secrets.`;
      drawPanel('BUSTED', BUSTED_LINES, 'Press Space to try the room again');
    } else if (screen === SCREEN_LEVEL_DONE) {
      LEVEL_DONE_LINES[0] = `${state.level.name} — clean getaway.`;
      LEVEL_DONE_LINES[1] = `Room take $${state.take.toLocaleString('en-US')} · Total $${state.totalTake.toLocaleString('en-US')}.`;
      LEVEL_DONE_LINES[2] = state.levelIndex + 1 < LEVELS.length ? `Next room: ${LEVELS[state.levelIndex + 1].name}` : '';
      drawPanel('CLEAN GETAWAY', LEVEL_DONE_LINES, 'Press Space for the next room');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = `The house wins this time. Total take $${state.totalTake.toLocaleString('en-US')}.`;
      OVER_LINES[1] = bestLabel(best);
      drawPanel('THE HOUSE WINS', OVER_LINES, 'Press Space to run it back');
    } else if (screen === SCREEN_WON) {
      const rating = state.peakAlarm < 40 ? 'GHOST — never even seen' : state.peakAlarm < 80 ? 'SMOOTH — a scare or two' : 'LOUD — but the vault is empty';
      WON_LINES[0] = `All three rooms. Total take $${state.totalTake.toLocaleString('en-US')}.`;
      WON_LINES[1] = rating;
      WON_LINES[2] = bestLabel(best);
      drawPanel('THE GOLDEN CHIP IS YOURS', WON_LINES, 'Press Space to run it back');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
