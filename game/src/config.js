// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Paddle geometry and speed. */
export const PADDLE = {
  width: 120,
  height: 18,
  y: 664,
  speed: 720,
  wideWidth: 190,
  wideSeconds: 12,
};

/** Ball geometry and speed. */
export const BALL = {
  radius: 9,
  speed: 520,
  speedPerLevel: 34,
  speedPerBrick: 2.5,
  maxSpeed: 880,
  slowFactor: 0.62,
  slowSeconds: 8,
  serveOffsetY: -26,
};

/** Brick grid geometry. */
export const GRID = {
  cols: 10,
  rows: 6,
  x: 72,
  y: 96,
  brickWidth: 108,
  brickHeight: 30,
  gapX: 6,
  gapY: 10,
};

/** Points per brick, by row from the top (row 0 is the top row). */
export const ROW_POINTS = [100, 90, 80, 70, 60, 50];
export const HARD_POINTS = 150;
export const BONUS_POINTS = 100;

/** Combo: each brick broken without the ball touching the paddle raises the multiplier. */
export const COMBO_MAX = 5;

export const LIVES_START = 3;
export const LIVES_MAX = 5;

/** How long a power-up lasts once caught (seconds); laser also has a shot count. */
export const POWER = {
  fallSpeed: 210,
  size: 26,
  wideSeconds: 12,
  laserSeconds: 10,
  laserShots: 12,
  slowSeconds: 8,
  boltSpeed: 780,
  boltWidth: 6,
  boltHeight: 18,
};

/** Particles spawned per brick broken, and the shake after losing a life. */
export const FX = {
  shardsPerBrick: 10,
  shardLife: 0.7,
  popupLife: 0.9,
  shakeSeconds: 0.35,
  shakePixels: 7,
};

/** Seconds of ball-trail kept for the glow trail. */
export const TRAIL = 12;

export const PALETTE = {
  backdrop: '#070713',
  field: '#0b0b22',
  grid: '#141436',
  wall: '#23235c',
  text: '#f2f2ff',
  muted: '#9a9ac4',
  dim: '#55557f',
  paddle: '#22e6ff',
  paddleWide: '#7c5cff',
  ball: '#ffffff',
  ballGlow: '#22e6ff',
  laser: '#ff4d6d',
  heart: '#ff4d6d',
  // Brick colours by row (top to bottom): hot pink, violet, cyan, green, amber, orange.
  rows: ['#ff2fd6', '#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#fb923c'],
  hard: '#e8e8f2',
  hardCrack: '#8a8aa8',
  steel: '#3f3f5e',
  steelEdge: '#6b6b96',
  bonus: '#fde047',
  popup: '#ffffff',
  panel: 'rgba(10, 10, 30, 0.88)',
  panelEdge: '#2de2ff',
  titleA: '#ff2fd6',
  titleB: '#22e6ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-breaker.best';
