// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between seven screens:
// title, play, paused, busted, level done, game over and won.
//
// ?seed=N fixes the random pattern. ?shot=cover|heist|alarm|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BUSTED,
  EVENT_DECOY,
  EVENT_EMP,
  EVENT_LEVEL_DONE,
  EVENT_LOOT,
  EVENT_MAIN_LOOT,
  EVENT_OVER,
  EVENT_SMOKE,
  EVENT_SPOTTED,
  EVENT_WON,
  createWorld,
} from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM,
  ACTION_EMP,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_SMOKE,
  createInput,
} from './input.js';
import {
  SCREEN_BUSTED,
  SCREEN_LEVEL_DONE,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WON,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take lasts this visit.
  }
}

// The playtest hook: the world and its state, for the browser to inspect.
window.__meridian = { world, state: world.state };

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0, audio.muted);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let footstepTimer = 0;
  let sirenOn = false;
  let pendingTool = null;

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    audio.unlock();
    world.resetRun();
    input.takeDecoyTarget();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three rooms stand between you and the Golden Chip.');
  }

  function retryRoom() {
    audio.unlock();
    audio.stopSiren();
    sirenOn = false;
    world.loadLevel(world.state.levelIndex);
    world.state.phase = 'play';
    input.takeDecoyTarget();
    screen = SCREEN_PLAY;
    announce(`Back in ${world.state.level.name}.`);
  }

  function nextRoom() {
    audio.unlock();
    world.loadLevel(world.state.levelIndex + 1);
    world.state.phase = 'play';
    input.takeDecoyTarget();
    screen = SCREEN_PLAY;
    announce(`Now entering ${world.state.level.name}.`);
  }

  function finishRun() {
    audio.stopSiren();
    sirenOn = false;
    if (world.state.totalTake > best) {
      best = world.state.totalTake;
      saveBest(best);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_SMOKE) pendingTool = 'smoke';
      else if (actions & ACTION_EMP) pendingTool = 'emp';
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WON) startRun();
      else if (screen === SCREEN_BUSTED) retryRoom();
      else if (screen === SCREEN_LEVEL_DONE) nextRoom();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function playStep() {
    const move = input.move();
    const tool = pendingTool;
    pendingTool = null;
    const decoy = input.takeDecoyTarget();
    const events = world.step(STEP, { mx: move.mx, my: move.my, slow: move.slow, tool, decoy }, false);
    const state = world.state;

    if (state.lockdown && !sirenOn) {
      audio.startSiren();
      sirenOn = true;
    } else if (!state.lockdown && sirenOn) {
      audio.stopSiren();
      sirenOn = false;
    }
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_LOOT) audio.pickup();
    if (events & EVENT_MAIN_LOOT) audio.mainLoot();
    if (events & EVENT_SMOKE) audio.smoke();
    if (events & EVENT_EMP) audio.emp();
    if (events & EVENT_DECOY) audio.decoy();
    if (events & EVENT_BUSTED) {
      audio.busted();
      audio.stopSiren();
      sirenOn = false;
      screen = events & EVENT_OVER ? SCREEN_OVER : SCREEN_BUSTED;
      if (events & EVENT_OVER) finishRun();
      announce(events & EVENT_OVER ? 'The house wins. No attempts left.' : 'Busted! The room resets.');
    } else if (events & EVENT_WON) {
      audio.win();
      finishRun();
      screen = SCREEN_WON;
      announce(`The Golden Chip is yours. Total take $${state.totalTake}.`);
    } else if (events & EVENT_LEVEL_DONE) {
      audio.levelDone();
      audio.stopSiren();
      sirenOn = false;
      screen = SCREEN_LEVEL_DONE;
      announce(`${state.level.name} cleared. Total take $${state.totalTake}.`);
    }
    if (state.player.moving && screen === SCREEN_PLAY) {
      footstepTimer -= STEP;
      if (footstepTimer <= 0) {
        audio.footstep();
        footstepTimer = 0.34;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, slow: false, tool: null, decoy: null }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        playStep();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting guards close
  // in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Meridian Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
