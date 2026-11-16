// Sound effects, synthesized live with the Web Audio API: no audio files, no
// network. Each effect is a short oscillator (or two) with an envelope. The
// context is created lazily on the first user gesture, because browsers block
// audio before one; every call before that is a silent no-op.

const NOTES = {
  paddle: 220,
  wall: 180,
  brick: 520,
  hard: 340,
  bonus: 740,
  power: 880,
  lose: 140,
  clear: 660,
  win: 784,
  launch: 300,
};

function tone(context, frequency, startAt, duration, type, volume, slideTo) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startAt + duration);
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

export function createAudio() {
  let context = null;

  /** Call from a user gesture so the browser lets audio start. */
  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
    } catch {
      context = null;
    }
  }

  function play(name) {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    switch (name) {
      case 'paddle':
        tone(context, NOTES.paddle, now, 0.07, 'square', 0.12, 330);
        break;
      case 'wall':
        tone(context, NOTES.wall, now, 0.05, 'square', 0.07);
        break;
      case 'brick':
        tone(context, NOTES.brick, now, 0.08, 'triangle', 0.16, 260);
        break;
      case 'hard':
        tone(context, NOTES.hard, now, 0.09, 'square', 0.12, 200);
        break;
      case 'bonus':
        tone(context, NOTES.bonus, now, 0.1, 'sine', 0.16, 1180);
        break;
      case 'power':
        tone(context, NOTES.power, now, 0.12, 'sine', 0.16, 1320);
        tone(context, NOTES.power * 1.5, now + 0.07, 0.12, 'sine', 0.12, 1760);
        break;
      case 'laser':
        tone(context, 1200, now, 0.08, 'sawtooth', 0.1, 300);
        break;
      case 'lose':
        tone(context, NOTES.lose, now, 0.35, 'sawtooth', 0.14, 55);
        break;
      case 'clear':
        [523, 659, 784, 1047].forEach((f, i) => tone(context, f, now + i * 0.09, 0.16, 'triangle', 0.14));
        break;
      case 'win':
        [523, 659, 784, 1047, 1319].forEach((f, i) => tone(context, f, now + i * 0.11, 0.22, 'triangle', 0.14));
        break;
      case 'launch':
        tone(context, NOTES.launch, now, 0.09, 'sine', 0.12, 520);
        break;
      default:
        break;
    }
  }

  return { unlock, play };
}
