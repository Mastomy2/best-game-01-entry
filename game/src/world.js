// The game world: paddle, balls, bricks, power-ups, particles and the score.
// No drawing here and no input here — step() advances the simulation one fixed
// step and reports what happened as event flags, so the loop can play sounds
// and change screens.

import {
  BALL,
  COMBO_MAX,
  FIELD,
  FX,
  GRID,
  HARD_POINTS,
  BONUS_POINTS,
  LIVES_MAX,
  LIVES_START,
  PADDLE,
  POWER,
  ROW_POINTS,
  TRAIL,
} from './config.js';
import { LEVELS, LEVEL_COUNT } from './levels.js';

export const EVENT_PADDLE = 1;
export const EVENT_WALL = 2;
export const EVENT_BRICK = 4;
export const EVENT_HARD = 8;
export const EVENT_BONUS = 16;
export const EVENT_POWER = 32;
export const EVENT_LASER = 64;
export const EVENT_LOSE = 128;
export const EVENT_OVER = 256;
export const EVENT_CLEAR = 512;
export const EVENT_WIN = 1024;
export const EVENT_LIFE = 2048;
export const EVENT_LAUNCH = 4096;

export const KIND_WIDE = 'W';
export const KIND_MULTI = 'M';
export const KIND_LASER = 'L';
export const KIND_SLOW = 'S';
export const KIND_LIFE = '+';

const POWER_KINDS = [KIND_WIDE, KIND_MULTI, KIND_LASER, KIND_SLOW, KIND_WIDE, KIND_MULTI, KIND_LIFE];
const MAX_BALLS = 5;

function brickAt(map, col, row) {
  return map[row] && map[row][col] ? map[row][col] : '.';
}

export function createWorld(random) {
  const state = {
    paddle: { x: 0, width: PADDLE.width, wideUntil: 0, laserUntil: 0, laserShots: 0 },
    balls: [],
    bricks: [],
    powerups: [],
    bolts: [],
    particles: [],
    popups: [],
    trail: [],
    score: 0,
    combo: 0,
    lives: LIVES_START,
    level: 0,
    levelName: LEVELS[0].name,
    bricksLeft: 0,
    shake: 0,
    time: 0,
  };

  function buildBricks(levelIndex) {
    const map = LEVELS[levelIndex].map;
    const bricks = [];
    let left = 0;
    for (let row = 0; row < GRID.rows; row += 1) {
      for (let col = 0; col < GRID.cols; col += 1) {
        const cell = brickAt(map, col, row);
        if (cell === '.') continue;
        const kind = cell === 'H' ? 'hard' : cell === 'S' ? 'steel' : cell === 'B' ? 'bonus' : 'standard';
        const brick = {
          x: GRID.x + col * (GRID.brickWidth + GRID.gapX),
          y: GRID.y + row * (GRID.brickHeight + GRID.gapY),
          width: GRID.brickWidth,
          height: GRID.brickHeight,
          row,
          kind,
          hp: kind === 'hard' ? 2 : 1,
          alive: true,
        };
        bricks.push(brick);
        if (kind !== 'steel') left += 1;
      }
    }
    return { bricks, left };
  }

  function serveBall() {
    const speed = ballSpeed();
    state.balls = [{
      x: state.paddle.x + state.paddle.width / 2,
      y: PADDLE.y + BALL.serveOffsetY,
      vx: 0,
      vy: 0,
      speed,
      stuck: true,
    }];
    state.trail = [];
  }

  function ballSpeed() {
    const broken = state.bricks.filter((b) => !b.alive && b.kind !== 'steel').length;
    return Math.min(
      BALL.speed + state.level * BALL.speedPerLevel + broken * BALL.speedPerBrick,
      BALL.maxSpeed,
    );
  }

  function loadLevel(levelIndex) {
    state.level = levelIndex;
    state.levelName = LEVELS[levelIndex].name;
    const built = buildBricks(levelIndex);
    state.bricks = built.bricks;
    state.bricksLeft = built.left;
    state.powerups = [];
    state.bolts = [];
    state.particles = [];
    state.popups = [];
    state.combo = 0;
    state.paddle.x = (FIELD.width - state.paddle.width) / 2;
    state.paddle.width = PADDLE.width;
    state.paddle.wideUntil = 0;
    state.paddle.laserUntil = 0;
    state.paddle.laserShots = 0;
    serveBall();
  }

  function reset() {
    state.score = 0;
    state.combo = 0;
    state.lives = LIVES_START;
    state.shake = 0;
    state.time = 0;
    loadLevel(0);
  }

  function spawnShards(x, y, color) {
    for (let i = 0; i < FX.shardsPerBrick; i += 1) {
      const angle = random.next() * Math.PI * 2;
      const speed = 120 + random.next() * 260;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: FX.shardLife * (0.6 + random.next() * 0.4),
        maxLife: FX.shardLife,
        color,
        size: 3 + random.next() * 5,
      });
    }
  }

  function addPopup(x, y, text, color) {
    state.popups.push({ x, y, text, color, life: FX.popupLife, maxLife: FX.popupLife });
  }

  function dropPowerUp(x, y) {
    state.powerups.push({
      x, y,
      kind: random.pick(POWER_KINDS),
      vy: POWER.fallSpeed,
    });
  }

  function applyPowerUp(kind) {
    const now = state.time;
    if (kind === KIND_WIDE) {
      state.paddle.width = PADDLE.wideWidth;
      state.paddle.wideUntil = now + POWER.wideSeconds;
    } else if (kind === KIND_MULTI) {
      const copies = [];
      for (const ball of state.balls) {
        if (state.balls.length + copies.length >= MAX_BALLS) break;
        copies.push({
          x: ball.x, y: ball.y,
          vx: -ball.vx || (random.next() < 0.5 ? -200 : 200),
          vy: ball.vy,
          speed: ball.speed,
          stuck: false,
        });
      }
      state.balls.push(...copies);
    } else if (kind === KIND_LASER) {
      state.paddle.laserUntil = now + POWER.laserSeconds;
      state.paddle.laserShots = POWER.laserShots;
    } else if (kind === KIND_SLOW) {
      for (const ball of state.balls) ball.slowUntil = now + POWER.slowSeconds;
    } else if (kind === KIND_LIFE) {
      if (state.lives < LIVES_MAX) state.lives += 1;
    }
  }

  function fireBolt() {
    if (state.paddle.laserShots <= 0 || state.time >= state.paddle.laserUntil) return false;
    const cx = state.paddle.x + state.paddle.width / 2;
    state.bolts.push({ x: state.paddle.x + 10, y: PADDLE.y - POWER.boltHeight, vy: -POWER.boltSpeed });
    state.bolts.push({ x: state.paddle.x + state.paddle.width - 10 - POWER.boltWidth, y: PADDLE.y - POWER.boltHeight, vy: -POWER.boltSpeed });
    state.paddle.laserShots -= 1;
    return true;
  }

  function launchBall() {
    for (const ball of state.balls) {
      if (!ball.stuck) continue;
      const angle = -Math.PI / 2 + (random.next() - 0.5) * 0.6;
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      ball.stuck = false;
      return true;
    }
    return false;
  }

  function breakBrick(brick, events) {
    brick.hp -= 1;
    if (brick.hp > 0) return events | EVENT_HARD;
    brick.alive = false;
    state.combo += 1;
    const mult = Math.min(state.combo, COMBO_MAX);
    let points = 0;
    let color = '#ffffff';
    if (brick.kind === 'hard') {
      points = HARD_POINTS;
      color = '#e8e8f2';
    } else if (brick.kind === 'bonus') {
      points = BONUS_POINTS;
      color = '#fde047';
      dropPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
      events |= EVENT_BONUS;
    } else {
      points = ROW_POINTS[brick.row] || 50;
      color = '#ffffff';
    }
    const gained = points * mult;
    state.score += gained;
    state.bricksLeft -= 1;
    spawnShards(brick.x + brick.width / 2, brick.y + brick.height / 2, color);
    addPopup(brick.x + brick.width / 2, brick.y, `+${gained}`, mult > 1 ? '#fde047' : '#ffffff');
    return events | EVENT_BRICK;
  }

  function collideBallWithBricks(ball, prevX, prevY) {
    let events = 0;
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
      const cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (dx * dx + dy * dy > BALL.radius * BALL.radius) continue;
      // Decide the bounce axis from where the ball came from.
      const wasAbove = prevY + BALL.radius <= brick.y;
      const wasBelow = prevY - BALL.radius >= brick.y + brick.height;
      if (wasAbove || wasBelow) {
        ball.vy = wasAbove ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        ball.y = wasAbove ? brick.y - BALL.radius : brick.y + brick.height + BALL.radius;
      } else {
        const wasLeft = prevX + BALL.radius <= brick.x;
        ball.vx = wasLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        ball.x = wasLeft ? brick.x - BALL.radius : brick.x + brick.width + BALL.radius;
      }
      events = breakBrick(brick, events);
      break;
    }
    return events;
  }

  function stepBall(ball, step, events) {
    const slow = ball.slowUntil && state.time < ball.slowUntil;
    const speed = ball.speed * (slow ? BALL.slowFactor : 1);
    const mag = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = (ball.vx / mag) * speed;
    ball.vy = (ball.vy / mag) * speed;
    const prevX = ball.x;
    const prevY = ball.y;
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;

    if (ball.x - BALL.radius < 0) {
      ball.x = BALL.radius;
      ball.vx = Math.abs(ball.vx);
      events |= EVENT_WALL;
    } else if (ball.x + BALL.radius > FIELD.width) {
      ball.x = FIELD.width - BALL.radius;
      ball.vx = -Math.abs(ball.vx);
      events |= EVENT_WALL;
    }
    if (ball.y - BALL.radius < 0) {
      ball.y = BALL.radius;
      ball.vy = Math.abs(ball.vy);
      events |= EVENT_WALL;
    }

    const paddle = state.paddle;
    if (ball.vy > 0
      && ball.y + BALL.radius >= PADDLE.y
      && ball.y - BALL.radius <= PADDLE.y + PADDLE.height
      && ball.x >= paddle.x - BALL.radius
      && ball.x <= paddle.x + paddle.width + BALL.radius) {
      const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)));
      const angle = offset * (Math.PI / 3);
      const s = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.sin(angle) * s;
      ball.vy = -Math.abs(Math.cos(angle) * s);
      ball.y = PADDLE.y - BALL.radius;
      state.combo = 0;
      events |= EVENT_PADDLE;
    }

    events |= collideBallWithBricks(ball, prevX, prevY);
    return events;
  }

  /** Advance the world one fixed step. `move` is -1, 0 or 1 (keyboard) and
   * `pointerX` a field x the paddle chases, or null. Returns event flags. */
  function step(stepSeconds, move, pointerX, fire) {
    let events = 0;
    state.time += stepSeconds;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - stepSeconds);

    const paddle = state.paddle;
    if (pointerX !== null && pointerX !== undefined) {
      const target = Math.max(0, Math.min(FIELD.width - paddle.width, pointerX - paddle.width / 2));
      const diff = target - paddle.x;
      const maxMove = PADDLE.speed * 1.6 * stepSeconds;
      paddle.x += Math.max(-maxMove, Math.min(maxMove, diff));
    } else if (move !== 0) {
      paddle.x = Math.max(0, Math.min(FIELD.width - paddle.width, paddle.x + move * PADDLE.speed * stepSeconds));
    }
    if (state.time >= paddle.wideUntil && paddle.width !== PADDLE.width) {
      paddle.width = PADDLE.width;
      paddle.x = Math.max(0, Math.min(FIELD.width - paddle.width, paddle.x));
    }

    if (fire) {
      if (launchBall()) events |= EVENT_LAUNCH;
      else if (fireBolt()) events |= EVENT_LASER;
    }

    for (const ball of state.balls) {
      if (ball.stuck) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = PADDLE.y + BALL.serveOffsetY;
        continue;
      }
      events |= stepBall(ball, stepSeconds, 0);
    }
    // Trail follows the first live ball.
    const lead = state.balls.find((b) => !b.stuck) || state.balls[0];
    if (lead) {
      state.trail.push({ x: lead.x, y: lead.y });
      if (state.trail.length > TRAIL) state.trail.shift();
    }

    // Balls that fell out the bottom are gone.
    const before = state.balls.length;
    state.balls = state.balls.filter((b) => b.y - BALL.radius <= FIELD.height + 40);
    if (state.balls.length < before && state.balls.length === 0) {
      state.lives -= 1;
      state.combo = 0;
      state.shake = FX.shakeSeconds;
      if (state.lives <= 0) return events | EVENT_LOSE | EVENT_OVER;
      serveBall();
      return events | EVENT_LOSE;
    }

    // Laser bolts: fly up, break the first brick they touch.
    for (const bolt of state.bolts) {
      bolt.y += bolt.vy * stepSeconds;
      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        if (bolt.x < brick.x + brick.width && bolt.x + POWER.boltWidth > brick.x
          && bolt.y < brick.y + brick.height && bolt.y + POWER.boltHeight > brick.y) {
          bolt.y = -100;
          events = breakBrick(brick, events);
          break;
        }
      }
    }
    state.bolts = state.bolts.filter((b) => b.y + POWER.boltHeight > 0);

    // Power-ups fall; the paddle catches them.
    for (const power of state.powerups) {
      power.y += power.vy * stepSeconds;
      if (power.y + POWER.size >= PADDLE.y && power.y <= PADDLE.y + PADDLE.height
        && power.x >= paddle.x - POWER.size / 2 && power.x <= paddle.x + paddle.width + POWER.size / 2) {
        power.y = FIELD.height + 100;
        const wasLife = power.kind === KIND_LIFE;
        applyPowerUp(power.kind);
        addPopup(power.x, PADDLE.y - 30, powerLabel(power.kind), '#7cf2c7');
        events |= wasLife ? EVENT_LIFE : EVENT_POWER;
      }
    }
    state.powerups = state.powerups.filter((p) => p.y < FIELD.height + 60);

    // Particles and popups age.
    for (const p of state.particles) {
      p.x += p.vx * stepSeconds;
      p.y += p.vy * stepSeconds;
      p.vy += 520 * stepSeconds;
      p.life -= stepSeconds;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const p of state.popups) {
      p.y -= 42 * stepSeconds;
      p.life -= stepSeconds;
    }
    state.popups = state.popups.filter((p) => p.life > 0);

    if (state.bricksLeft <= 0) {
      if (state.level + 1 >= LEVEL_COUNT) return events | EVENT_CLEAR | EVENT_WIN;
      return events | EVENT_CLEAR;
    }
    return events;
  }

  function powerLabel(kind) {
    if (kind === KIND_WIDE) return 'WIDE PADDLE';
    if (kind === KIND_MULTI) return 'MULTI-BALL';
    if (kind === KIND_LASER) return 'LASER';
    if (kind === KIND_SLOW) return 'SLOW BALL';
    return 'EXTRA LIFE';
  }

  function advanceLevel() {
    loadLevel(state.level + 1);
  }

  reset();
  return { state, reset, loadLevel, advanceLevel, step, launchBall, fireBolt };
}
