// Keyboard and pointer input. Held keys give a steering vector; one-shot
// presses (start, pause, tools, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never
// counted twice. A mouse click is a decoy-chip throw: the click point is
// converted from screen pixels to field coordinates by the renderer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_EMP = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SMOKE = new Set(['Digit1', 'KeyQ']);
const EMP = new Set(['Digit2', 'KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(target, toField) {
  const held = { up: false, down: false, left: false, right: false, slow: false };
  let actions = 0;
  let decoyTarget = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.slow = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (SMOKE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SMOKE;
    } else if (EMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_EMP;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.slow = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.slow = false;
  });
  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    decoyTarget = toField(event.clientX, event.clientY);
  });

  return {
    /** The steering vector: -1..1 on each axis. */
    move() {
      return {
        mx: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        my: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        slow: held.slow,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click point in field coordinates, taken once. */
    takeDecoyTarget() {
      const taken = decoyTarget;
      decoyTarget = null;
      return taken;
    },
  };
}
