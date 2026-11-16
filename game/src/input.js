// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (launch/fire, pause) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The pointer steers the paddle directly; moving the mouse sets the target,
// and the keyboard takes over the moment a key is held.

export const ACTION_FIRE = 1;
export const ACTION_PAUSE = 2;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const FIRE = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let actions = 0;
  let pointerX = null;
  let pointerSeen = 0;

  function toFieldX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = 1280 / rect.width;
    return (clientX - rect.left) * scale;
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (FIRE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_FIRE;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    pointerX = toFieldX(event.clientX);
    pointerSeen = performance.now();
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointerX = toFieldX(event.clientX);
    pointerSeen = performance.now();
    actions |= ACTION_FIRE;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** Field x the paddle should chase, or null when the mouse is idle. */
    pointer() {
      if (pointerX === null) return null;
      if (performance.now() - pointerSeen > 3000) return null;
      if (left || right) return null;
      return pointerX;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
