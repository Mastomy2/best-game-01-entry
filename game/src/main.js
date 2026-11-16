// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, level clear, game over and win.
//
// ?seed=N fixes the random deal. ?shot=start|play|end|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  EVENT_BONUS,
  EVENT_BRICK,
  EVENT_CLEAR,
  EVENT_HARD,
  EVENT_LASER,
  EVENT_LAUNCH,
  EVENT_LIFE,
  EVENT_LOSE,
  EVENT_OVER,
  EVENT_PADDLE,
  EVENT_POWER,
  EVENT_WALL,
  EVENT_WIN,
  createWorld,
} from './world.js';
import { ACTION_FIRE, ACTION_PAUSE, createInput } from './input.js';
import {
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

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
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing Neon Breaker. ${world.state.lives} lives, level 1.`);
  }

  function finishScore() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_PADDLE) audio.play('paddle');
    if (events & EVENT_WALL) audio.play('wall');
    if (events & EVENT_BRICK) audio.play('brick');
    if (events & EVENT_HARD) audio.play('hard');
    if (events & EVENT_BONUS) audio.play('bonus');
    if (events & EVENT_POWER) audio.play('power');
    if (events & EVENT_LIFE) audio.play('power');
    if (events & EVENT_LASER) audio.play('laser');
    if (events & EVENT_LAUNCH) audio.play('launch');
    if (events & EVENT_LOSE) {
      audio.play('lose');
      announce(`Ball lost. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_CLEAR) {
      audio.play('clear');
      if (events & EVENT_WIN) {
        finishScore();
        screen = SCREEN_WIN;
        announce(`You win! Final score ${world.state.score}.`);
      } else {
        screen = SCREEN_CLEAR;
        announce(`Level ${world.state.level + 1} clear. Score ${world.state.score}.`);
      }
    }
    if (events & EVENT_OVER) {
      finishScore();
      screen = SCREEN_OVER;
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_FIRE) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_CLEAR) {
        world.advanceLevel();
        accumulator = 0;
        screen = SCREEN_PLAY;
        announce(`Level ${world.state.level + 1}: ${world.state.levelName}.`);
      } else if (screen === SCREEN_PLAY) {
        fireQueued = true;
      }
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  let fireQueued = false;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const fire = fireQueued;
        fireQueued = false;
        const events = world.step(STEP, input.direction(), input.pointer(), fire);
        handleEvents(events);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      fireQueued = false;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the ball drop unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Breaker. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
