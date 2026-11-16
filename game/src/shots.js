// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by an
// autopilot (predict where the ball will land and put the paddle there), so
// the frame is what a real game looks like and the same seed always gives the
// same frame.

import { BALL, FIELD, PADDLE, STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 0;
const PLAY_SECONDS = 22;
const END_SECONDS = 240;
const WIN_SECONDS = 240;

/** Predict the x where the ball crosses the paddle's line, with wall bounces. */
function landingX(ball) {
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  if (vy <= 0) return FIELD.width / 2;
  const dt = 1 / 120;
  for (let t = 0; t < 4; t += dt) {
    x += vx * dt;
    y += vy * dt;
    if (x - BALL.radius < 0) {
      x = BALL.radius;
      vx = Math.abs(vx);
    } else if (x + BALL.radius > FIELD.width) {
      x = FIELD.width - BALL.radius;
      vx = -Math.abs(vx);
    }
    if (y >= PADDLE.y) return x;
  }
  return x;
}

/**
 * Steer the paddle under the falling ball; launch when a ball is stuck. The
 * paddle is aimed a little off-centre (flipping side on every paddle bounce)
 * so the ball leaves at an angle and sweeps the field instead of bouncing
 * straight up and down one column forever.
 */
function makeGoodPilot() {
  let prevVy = 0;
  let aim = 30;
  return function pilot(world) {
    const state = world.state;
    const stuck = state.balls.some((b) => b.stuck);
    if (stuck) return { pointerX: FIELD.width / 2, fire: true };
    const falling = state.balls.find((b) => !b.stuck && b.vy > 0);
    const ball = falling || state.balls.find((b) => !b.stuck);
    if (!ball) return { pointerX: FIELD.width / 2, fire: false };
    if (prevVy > 0 && ball.vy < 0) aim = -aim;
    prevVy = ball.vy;
    const target = ball.vy > 0 ? landingX(ball) + aim : ball.x;
    const laser = state.time < state.paddle.laserUntil && state.paddle.laserShots > 0;
    return { pointerX: target, fire: laser };
  };
}

/** A hopeless pilot: the paddle never moves, so every ball is lost in turn. */
function frozenPilot(world) {
  const state = world.state;
  const stuck = state.balls.some((b) => b.stuck);
  return { pointerX: null, fire: stuck };
}

/** Step the world for up to `seconds`, steering with `pilot`, until `done` says stop. */
function simulate(world, seconds, pilot, done) {
  const steps = Math.ceil(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const { pointerX, fire } = pilot(world);
    const events = world.step(STEP, 0, pointerX, fire);
    if (done && done(events)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, end, win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, null, false);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    simulate(world, PLAY_SECONDS, makeGoodPilot(), (events) => (events & EVENT_CLEAR) !== 0);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    // Play the final level for a while first so the win screen shows a real
    // final score, then stage it down to its last brick and let the good
    // pilot break it: the win screen shows a real cleared final level.
    world.loadLevel(4);
    simulate(world, 25, makeGoodPilot(), null);
    let kept = false;
    for (const brick of world.state.bricks) {
      if (brick.kind === 'steel' || brick.alive === false) continue;
      if (!kept) {
        kept = true;
        continue;
      }
      brick.alive = false;
    }
    world.state.bricksLeft = kept ? 1 : 0;
    if (!kept) return { screen: SCREEN_PLAY, best: world.state.score };
    const events = simulate(world, WIN_SECONDS, makeGoodPilot(), (e) => (e & EVENT_WIN) !== 0);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // end: the frozen pilot loses every ball until the game is over.
  const events = simulate(world, END_SECONDS, frozenPilot, (e) => (e & EVENT_OVER) !== 0);
  if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
  world.state.lives = 0;
  return { screen: SCREEN_OVER, best: world.state.score };
}
