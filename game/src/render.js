// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Neon glow is faked with layered fills and
// shadowBlur kept small so a frame stays cheap. Text that holds a number is
// rebuilt only when the number changes, so a frame allocates nothing.

import { BALL, FIELD, FONT, GRID, LIVES_MAX, PALETTE, PADDLE, POWER } from './config.js';
import { KIND_LASER, KIND_LIFE, KIND_MULTI, KIND_SLOW, KIND_WIDE } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 132, line: 32, bottom: 76 };
const HEART = { size: 20, gap: 8 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function starfield() {
  const random = createRandom(1337);
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({
      x: random.next() * FIELD.width,
      y: random.next() * FIELD.height,
      r: 0.6 + random.next() * 1.6,
      a: 0.25 + random.next() * 0.55,
    });
  }
  return stars;
}

const STARS = starfield();

function powerColor(kind) {
  if (kind === KIND_WIDE) return '#7c5cff';
  if (kind === KIND_MULTI) return '#22d3ee';
  if (kind === KIND_LASER) return '#ff4d6d';
  if (kind === KIND_SLOW) return '#34d399';
  if (kind === KIND_LIFE) return '#ff8fa3';
  return '#ffffff';
}

function powerLetter(kind) {
  if (kind === KIND_WIDE) return 'W';
  if (kind === KIND_MULTI) return 'M';
  if (kind === KIND_LASER) return 'L';
  if (kind === KIND_SLOW) return 'S';
  return '+';
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const levelLabel = cachedLabel('LEVEL ');
  const finalLabel = cachedLabel('SCORE ');
  const fonts = new Map();

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

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowRect(x, y, w, h, color, glow) {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = glow;
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
    context.restore();
  }

  function drawBackground() {
    context.fillStyle = PALETTE.field;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of STARS) {
      context.globalAlpha = star.a;
      context.fillStyle = '#cdd2ff';
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    // Side walls and the top rail.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, 10, FIELD.height);
    context.fillRect(FIELD.width - 10, 0, 10, FIELD.height);
    context.fillRect(0, 0, FIELD.width, 10);
  }

  function drawBricks(state) {
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const { x, y, width, height } = brick;
      if (brick.kind === 'steel') {
        context.fillStyle = PALETTE.steel;
        context.fillRect(x, y, width, height);
        context.fillStyle = PALETTE.steelEdge;
        context.fillRect(x + 6, y + 6, width - 12, 4);
        context.fillRect(x + 6, y + height - 10, width - 12, 4);
        continue;
      }
      const color = brick.kind === 'hard'
        ? (brick.hp > 1 ? PALETTE.hard : PALETTE.hardCrack)
        : brick.kind === 'bonus' ? PALETTE.bonus : PALETTE.rows[brick.row] || PALETTE.rows[0];
      glowRect(x, y, width, height, color, 10);
      context.fillStyle = 'rgba(255,255,255,0.28)';
      context.fillRect(x + 4, y + 4, width - 8, 6);
      if (brick.kind === 'bonus') {
        text('★', x + width / 2, y + height / 2 + 8, 20, '#3a2b00', 'center', 'middle');
      } else if (brick.kind === 'hard' && brick.hp === 1) {
        context.strokeStyle = 'rgba(20,20,40,0.7)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 12, y + 6);
        context.lineTo(x + width / 2, y + height / 2);
        context.lineTo(x + width - 18, y + height - 6);
        context.stroke();
      }
    }
  }

  function drawPaddle(state) {
    const paddle = state.paddle;
    const wide = paddle.width > 120;
    const color = wide ? PALETTE.paddleWide : PALETTE.paddle;
    glowRect(paddle.x, PADDLE.y, paddle.width, PADDLE.height, color, 16);
    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.fillRect(paddle.x + 6, PADDLE.y + 3, paddle.width - 12, 4);
    if (state.time < paddle.laserUntil && paddle.laserShots > 0) {
      context.fillStyle = PALETTE.laser;
      context.fillRect(paddle.x + 8, PADDLE.y - 8, 8, 8);
      context.fillRect(paddle.x + paddle.width - 16, PADDLE.y - 8, 8, 8);
    }
  }

  function drawBalls(state) {
    for (const ball of state.balls) {
      // Glow trail.
      for (let i = 0; i < state.trail.length; i += 1) {
        const p = state.trail[i];
        const a = (i / state.trail.length) * 0.35;
        context.globalAlpha = a;
        context.fillStyle = PALETTE.ballGlow;
        context.beginPath();
        context.arc(p.x, p.y, BALL.radius * (0.4 + 0.6 * (i / state.trail.length)), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.save();
      context.shadowColor = PALETTE.ballGlow;
      context.shadowBlur = 18;
      context.fillStyle = PALETTE.ball;
      context.beginPath();
      context.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawBolts(state) {
    context.fillStyle = PALETTE.laser;
    for (const bolt of state.bolts) {
      glowRect(bolt.x, bolt.y, POWER.boltWidth, POWER.boltHeight, PALETTE.laser, 8);
    }
  }

  function drawPowerups(state) {
    for (const power of state.powerups) {
      const color = powerColor(power.kind);
      const cx = power.x;
      const cy = power.y;
      glowRect(cx - POWER.size / 2, cy - POWER.size / 2, POWER.size, POWER.size, color, 12);
      text(powerLetter(power.kind), cx, cy + 7, 18, '#0b0b22', 'center', 'middle');
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    for (const p of state.popups) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      text(p.text, p.x, p.y, 20, p.color, 'center', 'middle');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left');
    text(bestLabel(best), 24, 48, 16, PALETTE.muted, 'left');
    text(levelLabel(`${state.level + 1} · ${state.levelName}`), FIELD.width / 2, 18, 26, PALETTE.text, 'center');
    text(`${state.bricksLeft} bricks`, FIELD.width / 2, 48, 16, PALETTE.muted, 'center');
    const firstHeart = FIELD.width - 24 - LIVES_MAX * (HEART.size + HEART.gap) + HEART.gap;
    text('LIVES', firstHeart - 12, 20, 22, PALETTE.text, 'right');
    for (let i = 0; i < LIVES_MAX; i += 1) {
      const hx = firstHeart + i * (HEART.size + HEART.gap);
      const hy = 24;
      context.fillStyle = i < state.lives ? PALETTE.heart : PALETTE.dim;
      context.beginPath();
      context.arc(hx + 6, hy + 6, 6, 0, Math.PI * 2);
      context.arc(hx + 14, hy + 6, 6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(hx, hy + 8);
      context.lineTo(hx + 20, hy + 8);
      context.lineTo(hx + 10, hy + 19);
      context.closePath();
      context.fill();
    }
    if (state.combo > 1) {
      text(`COMBO x${Math.min(state.combo, 5)}`, FIELD.width - 24, 56, 22, '#fde047', 'right');
    }
    // Active power-up timers.
    let ty = 84;
    const paddle = state.paddle;
    if (paddle.width > 120) {
      text(`WIDE ${Math.max(0, paddle.wideUntil - state.time).toFixed(0)}s`, FIELD.width - 24, ty, 16, '#7c5cff', 'right');
      ty += 22;
    }
    if (state.time < paddle.laserUntil && paddle.laserShots > 0) {
      text(`LASER ${paddle.laserShots} shots`, FIELD.width - 24, ty, 16, '#ff4d6d', 'right');
      ty += 22;
    }
    const lead = state.balls[0];
    if (lead && lead.slowUntil && state.time < lead.slowUntil) {
      text(`SLOW ${Math.max(0, lead.slowUntil - state.time).toFixed(0)}s`, FIELD.width - 24, ty, 16, '#34d399', 'right');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.bonus, 'center');
  }

  const TITLE_LINES = [
    'Break every brick. Clear all 5 levels to win.',
    'Move: mouse or ← → / A D · Launch & laser: Space or click',
    'Catch falling power-ups: W wide · M multi-ball · L laser',
    'S slow ball · + extra life — steel bricks never break.',
    '',
  ];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.shake > 0 ? 1 : 0;
    const sx = shake ? (Math.random() - 0.5) * 14 * state.shake * 3 : 0;
    const sy = shake ? (Math.random() - 0.5) * 14 * state.shake * 3 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawBackground();
    drawBricks(state);
    drawPowerups(state);
    drawBolts(state);
    drawPaddle(state);
    drawBalls(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? `Best score: ${best}` : 'No score yet — be the first to clear Neon Crown.';
      drawPanel('NEON BREAKER', TITLE_LINES, 'Press Space or click to start', PALETTE.titleA);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The bricks will wait for you.'], 'Press P to resume', PALETTE.titleB);
    } else if (screen === SCREEN_CLEAR) {
      drawPanel(`LEVEL ${state.level + 1} CLEAR`, [
        `${state.levelName} cleared.`,
        `Score ${state.score} · Best ${best}`,
        '',
      ], 'Press Space or click for the next level', '#34d399');
    } else if (screen === SCREEN_OVER) {
      drawPanel('GAME OVER', [
        `Score ${state.score}`,
        `Best ${best}`,
        `You reached level ${state.level + 1} — ${state.levelName}.`,
      ], 'Press Space or click to play again', PALETTE.laser);
    } else if (screen === SCREEN_WIN) {
      drawPanel('YOU WIN!', [
        'Neon Crown cleared. Every brick broken.',
        `Final score ${state.score} · Best ${best}`,
        '',
      ], 'Press Space or click to play again', '#fde047');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
