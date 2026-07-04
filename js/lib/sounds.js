export const SUCCESS_MELODIES = [
  { id: 'chime', label: 'Динь' },
  { id: 'rise', label: 'Готово' },
  { id: 'bell', label: 'Пинг' },
  { id: 'pop', label: 'Щелчок' },
  { id: 'fanfare', label: 'Отметка' },
];

export const FAIL_MELODIES = [
  { id: 'drop', label: 'Спад' },
  { id: 'buzz', label: 'Брр' },
  { id: 'wobble', label: 'Увы' },
  { id: 'nuh', label: 'Нет' },
  { id: 'thud', label: 'Тук' },
];

const SUCCESS_IDS = new Set(SUCCESS_MELODIES.map(m => m.id));
const FAIL_IDS = new Set(FAIL_MELODIES.map(m => m.id));
const SOUND_MODES = new Set(['both', 'correct', 'wrong', 'none']);

export function normalizeSuccessSoundId(id) {
  return SUCCESS_IDS.has(id) ? id : 'chime';
}

export function normalizeFailSoundId(id) {
  return FAIL_IDS.has(id) ? id : 'drop';
}

export function normalizeAnswerSoundMode(mode) {
  return SOUND_MODES.has(mode) ? mode : 'both';
}

export function successSoundLabel(id) {
  return SUCCESS_MELODIES.find(m => m.id === id)?.label || 'Динь';
}

export function failSoundLabel(id) {
  return FAIL_MELODIES.find(m => m.id === id)?.label || 'Спад';
}

function hit(ctx, { freq, start, dur = 0.05, peak = 0.17, type = 'sine', slide = 1 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide !== 1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * slide), start + dur);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

function doubleHit(ctx, t0, a, b, gap = 0.04) {
  hit(ctx, { ...a, start: t0 });
  hit(ctx, { ...b, start: t0 + gap });
}

const SUCCESS_SEQUENCES = {
  chime: (ctx, t0) => {
    doubleHit(ctx, t0,
      { freq: 1174.66, dur: 0.048, peak: 0.16, type: 'sine' },
      { freq: 1567.98, dur: 0.055, peak: 0.14, type: 'sine' },
      0.042,
    );
  },
  rise: (ctx, t0) => {
    [987.77, 1174.66, 1396.91].forEach((f, i) => {
      hit(ctx, { freq: f, start: t0 + i * 0.038, dur: 0.04, peak: 0.13, type: 'triangle' });
    });
  },
  bell: (ctx, t0) => {
    hit(ctx, { freq: 2093, start: t0, dur: 0.11, peak: 0.15, type: 'triangle', slide: 0.72 });
    hit(ctx, { freq: 4186, start: t0, dur: 0.07, peak: 0.05, type: 'sine', slide: 0.65 });
  },
  pop: (ctx, t0) => {
    hit(ctx, { freq: 2200, start: t0, dur: 0.028, peak: 0.19, type: 'square' });
    hit(ctx, { freq: 880, start: t0 + 0.012, dur: 0.022, peak: 0.06, type: 'sine' });
  },
  fanfare: (ctx, t0) => {
    hit(ctx, { freq: 523.25, start: t0, dur: 0.045, peak: 0.12, type: 'triangle' });
    hit(ctx, { freq: 1318.51, start: t0 + 0.05, dur: 0.065, peak: 0.15, type: 'sine' });
    hit(ctx, { freq: 1567.98, start: t0 + 0.095, dur: 0.05, peak: 0.1, type: 'sine' });
  },
};

const FAIL_SEQUENCES = {
  drop: (ctx, t0) => {
    doubleHit(ctx, t0,
      { freq: 440, dur: 0.055, peak: 0.14, type: 'triangle', slide: 0.55 },
      { freq: 311, dur: 0.07, peak: 0.12, type: 'sine', slide: 0.5 },
      0.05,
    );
  },
  buzz: (ctx, t0) => {
    hit(ctx, { freq: 147, start: t0, dur: 0.09, peak: 0.11, type: 'square' });
    hit(ctx, { freq: 110, start: t0 + 0.045, dur: 0.07, peak: 0.08, type: 'square' });
  },
  wobble: (ctx, t0) => {
    [349.23, 293.66, 261.63].forEach((f, i) => {
      hit(ctx, { freq: f, start: t0 + i * 0.045, dur: 0.06, peak: 0.1, type: 'triangle', slide: 0.7 });
    });
  },
  nuh: (ctx, t0) => {
    hit(ctx, { freq: 392, start: t0, dur: 0.04, peak: 0.12, type: 'sine', slide: 0.6 });
    hit(ctx, { freq: 330, start: t0 + 0.055, dur: 0.05, peak: 0.1, type: 'sine', slide: 0.55 });
  },
  thud: (ctx, t0) => {
    hit(ctx, { freq: 196, start: t0, dur: 0.08, peak: 0.15, type: 'triangle' });
    hit(ctx, { freq: 98, start: t0, dur: 0.1, peak: 0.07, type: 'sine' });
  },
};

function shouldPlaySound(isCorrect, mode) {
  const m = normalizeAnswerSoundMode(mode);
  if (m === 'none') return false;
  if (isCorrect) return m === 'both' || m === 'correct';
  return m === 'both' || m === 'wrong';
}

function playSequence(sequences, id, opts = {}) {
  const reduced = !opts.preview
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduced) return;
  const play = sequences[id] || sequences[Object.keys(sequences)[0]];
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    play(ctx, ctx.currentTime);
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 420);
  } catch (e) {}
}

export function playSuccessSound(melodyId = 'chime', opts = {}) {
  playSequence(SUCCESS_SEQUENCES, normalizeSuccessSoundId(melodyId), opts);
}

export function playFailSound(melodyId = 'drop', opts = {}) {
  playSequence(FAIL_SEQUENCES, normalizeFailSoundId(melodyId), opts);
}

export function playAnswerFeedback(isCorrect, settings) {
  if (!settings) return;
  const mode = settings.answerSoundMode;
  if (!shouldPlaySound(isCorrect, mode)) return;
  if (isCorrect) playSuccessSound(settings.successSound);
  else playFailSound(settings.failSound);
}

export function playAnswerFeedbackFromStore(isCorrect) {
  if (typeof document === 'undefined') return;
  import('../core/state.js').then(({ store }) => {
    playAnswerFeedback(isCorrect, store?.settings);
  }).catch(() => {});
}

/** @deprecated use playAnswerFeedbackFromStore(true) */
export function playConfiguredSuccessSound(settings) {
  if (settings) playAnswerFeedback(true, settings);
  else playAnswerFeedbackFromStore(true);
}
