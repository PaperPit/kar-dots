export const SUCCESS_MELODIES = [
  { id: 'clear-combo', label: 'Clear combo', file: 'audio/success/clear-combo.mp3' },
  { id: 'ui-pop', label: 'UI pop', file: 'audio/success/ui-pop.mp3' },
  { id: 'soft-plopp', label: 'Soft plopp', file: 'audio/success/soft-plopp.mp3' },
  { id: 'ui-notification', label: 'UI notify', file: 'audio/success/ui-notification.mp3' },
  { id: 'confirm-tap', label: 'Confirm tap', file: 'audio/success/confirm-tap.mp3' },
];

/** Старые id синтезированных мелодий → новые MP3 (миграция настроек). */
const LEGACY_SUCCESS = {
  chime: 'confirm-tap',
  rise: 'clear-combo',
  bell: 'ui-notification',
  pop: 'ui-pop',
  fanfare: 'soft-plopp',
};

export const FAIL_MELODIES = [
  { id: 'game-button', label: 'Игровая кнопка', file: 'audio/fail/game-button.mp3' },
  { id: 'sword-cut', label: 'Резкий удар', file: 'audio/fail/sword-cut.mp3' },
  { id: 'short-fail', label: 'Короткий сбой', file: 'audio/fail/short-fail.mp3' },
  { id: 'glitch-error', label: 'Глитч ошибки', file: 'audio/fail/glitch-error.mp3' },
  { id: 'load-fail', label: 'Сбой загрузки', file: 'audio/fail/load-fail.mp3' },
];

/** Старые id синтезированных мелодий → новые MP3 (миграция настроек). */
const LEGACY_FAIL = {
  drop: 'load-fail',
  buzz: 'short-fail',
  wobble: 'glitch-error',
  nuh: 'game-button',
  thud: 'sword-cut',
};

/** MP3-мелодии экрана с кубком (файлы в audio/). */
export const CUP_MELODIES = [
  { id: 'game-bonus', label: 'Игровой бонус', file: 'audio/game-bonus.mp3' },
  { id: 'show-alert', label: 'Шоу алерт', file: 'audio/show-alert.mp3' },
  { id: 'level-up', label: 'Level up', file: 'audio/level-up.mp3' },
  { id: 'victory-chime', label: 'Победный звон', file: 'audio/victory-chime.mp3' },
  { id: 'correct-answer', label: 'Верный ответ', file: 'audio/correct-answer.mp3' },
];

/** Звук системных кликов (кнопки, вкладки, меню). */
export const UI_CLICK_MELODIES = [
  { id: 'none', label: 'Без звука' },
  { id: 'system-click', label: 'Системный клик', file: 'audio/ui/system-click.mp3' },
  { id: 'click-soft', label: 'Мягкий клик', file: 'audio/ui/click-soft.mp3' },
  { id: 'click-crisp', label: 'Чёткий клик', file: 'audio/ui/click-crisp.mp3' },
];

const SUCCESS_IDS = new Set(SUCCESS_MELODIES.map(m => m.id));
const FAIL_IDS = new Set(FAIL_MELODIES.map(m => m.id));
const CUP_IDS = new Set(CUP_MELODIES.map(m => m.id));
const UI_CLICK_IDS = new Set(UI_CLICK_MELODIES.map(m => m.id));
const SOUND_MODES = new Set(['both', 'correct', 'wrong', 'none']);

/** Частоты нот (равномерная темперация) — удобнее писать мелодии «как в сиквенсоре». */
const N = {
  C2: 65.41, E2: 82.41, G2: 98.00, A2: 110.00,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, Eb4: 311.13, F4: 349.23, G4: 392.00, Ab4: 415.30,
  A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99,
  A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.00,
};

const PULSE_CURVES = new Map();

export function normalizeSuccessSoundId(id) {
  if (SUCCESS_IDS.has(id)) return id;
  if (LEGACY_SUCCESS[id]) return LEGACY_SUCCESS[id];
  return 'confirm-tap';
}

export function normalizeFailSoundId(id) {
  if (FAIL_IDS.has(id)) return id;
  if (LEGACY_FAIL[id]) return LEGACY_FAIL[id];
  return 'load-fail';
}

export function normalizeAnswerSoundMode(mode) {
  return SOUND_MODES.has(mode) ? mode : 'both';
}

export function successSoundLabel(id) {
  return SUCCESS_MELODIES.find(m => m.id === id)?.label || 'Confirm tap';
}

let mp3Audio = { success: null, fail: null, cup: null, uiClick: null };

function playMp3(file, slot, opts = {}, volume = 0.85) {
  if (typeof Audio === 'undefined') return;
  const reduced = !opts.preview && !opts.gameplay
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduced) return;
  try {
    let audio = mp3Audio[slot];
    if (!audio || audio.__soundFile !== file) {
      audio = new Audio(file);
      audio.__soundFile = file;
      mp3Audio[slot] = audio;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch (e) {}
}

function primeMp3(file, slot, volume = 0.001) {
  if (typeof Audio === 'undefined') return;
  try {
    let audio = mp3Audio[slot];
    if (!audio || audio.__soundFile !== file) {
      audio = new Audio(file);
      audio.__soundFile = file;
      mp3Audio[slot] = audio;
    }
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(() => {});
  } catch (e) {}
}

export function failSoundLabel(id) {
  return FAIL_MELODIES.find(m => m.id === id)?.label || 'Сбой загрузки';
}

export function normalizeCupMelodyId(id) {
  return CUP_IDS.has(id) ? id : 'show-alert';
}

export function cupMelodyLabel(id) {
  return CUP_MELODIES.find(m => m.id === id)?.label || 'Шоу алерт';
}

export function normalizeUiClickSoundId(id) {
  return UI_CLICK_IDS.has(id) ? id : 'none';
}

export function uiClickSoundLabel(id) {
  return UI_CLICK_MELODIES.find(m => m.id === id)?.label || 'Без звука';
}

export function playUiClickSound(melodyId = 'none', opts = {}) {
  const id = normalizeUiClickSoundId(melodyId);
  if (id === 'none') return;
  const meta = UI_CLICK_MELODIES.find(m => m.id === id);
  if (!meta?.file) return;
  playMp3(meta.file, 'uiClick', opts, 0.65);
}

/** Проиграть MP3 при появлении кубка. */
export function playCupMelody(melodyId = 'show-alert', opts = {}) {
  const meta = CUP_MELODIES.find(m => m.id === normalizeCupMelodyId(melodyId));
  if (!meta) return;
  playMp3(meta.file, 'cup', opts, 0.9);
}

/** Кривая pulse-волны (NES duty cycle) через WaveShaper + sawtooth. */
function pulseCurve(duty = 0.25) {
  const key = String(duty);
  if (!PULSE_CURVES.has(key)) {
    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const phase = (x + 1) / 2;
      curve[i] = phase < duty ? 1 : -1;
    }
    PULSE_CURVES.set(key, curve);
  }
  return PULSE_CURVES.get(key);
}

function createMaster(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.82;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9200;
  lp.Q.value = 0.6;
  lp.connect(master);
  master.connect(ctx.destination);
  return lp;
}

/** Один «канал» APU: pulse / square / triangle. */
function chipTone(ctx, dest, {
  freq, start, dur = 0.08, peak = 0.11, voice = 'pulse', duty = 0.25, slide = null,
}) {
  const gain = ctx.createGain();
  gain.connect(dest);

  let osc;
  if (voice === 'pulse') {
    osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const shaper = ctx.createWaveShaper();
    shaper.curve = pulseCurve(duty);
    shaper.oversample = 'none';
    osc.connect(shaper);
    shaper.connect(gain);
  } else {
    osc = ctx.createOscillator();
    osc.type = voice === 'triangle' ? 'triangle' : 'square';
    osc.connect(gain);
  }

  osc.frequency.setValueAtTime(freq, start);
  if (slide != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(55, slide), start + dur);
  }

  const atk = 0.003;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + atk);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.start(start);
  osc.stop(start + dur + 0.015);
}

/** Шумовой канал (удар / «бочка» / свист). */
function chipNoise(ctx, dest, {
  start, dur = 0.05, peak = 0.07, filter = 5000, filterType = 'bandpass',
}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = filter;
  filt.Q.value = 0.8;
  const gain = ctx.createGain();
  src.connect(filt);
  filt.connect(gain);
  gain.connect(dest);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.start(start);
  src.stop(start + dur + 0.01);
}

/** Быстрое чередование нот — имитация аккорда на 2A03. */
function chipArp(ctx, dest, freqs, t0, step = 0.052, opts = {}) {
  freqs.forEach((freq, i) => {
    chipTone(ctx, dest, {
      freq, start: t0 + i * step, dur: step * 1.35, peak: 0.1, voice: 'pulse', duty: 0.25,
      ...opts,
    });
  });
}

/** Равномерная мелодия — типичный CC0 chiptune-паттерн. */
function chipMelody(ctx, dest, freqs, t0, step, opts = {}) {
  freqs.forEach((freq, i) => {
    chipTone(ctx, dest, {
      freq, start: t0 + i * step, dur: step * 1.4, voice: 'pulse', duty: 0.25, peak: 0.1,
      ...opts,
    });
  });
}

function playEvents(ctx, t0, events, dest) {
  for (const e of events) {
    const at = t0 + (e.t || 0);
    if (e.noise) {
      chipNoise(ctx, dest, { start: at, ...e.noise });
    } else {
      chipTone(ctx, dest, { start: at, ...e });
    }
  }
}

const LESSON_COMPLETE = {
  /** 1★ — тихая надежда, 3 ноты вверх. */
  1: (ctx, t0) => {
    const dest = createMaster(ctx);
    [N.E4, N.G4, N.A4].forEach((freq, i) => {
      chipTone(ctx, dest, {
        freq, start: t0 + i * 0.13, dur: 0.14, peak: 0.08 + i * 0.01, voice: 'pulse', duty: 0.25,
      });
    });
    chipTone(ctx, dest, { freq: N.A2, start: t0, dur: 0.38, peak: 0.05, voice: 'triangle' });
  },

  /** 2★ — арпеджио + ответная фраза. */
  2: (ctx, t0) => {
    const dest = createMaster(ctx);
    chipArp(ctx, dest, [N.C5, N.E5, N.G5, N.C6], t0, 0.065, { peak: 0.1 });
    [N.G5, N.E5, N.C5].forEach((freq, i) => {
      chipTone(ctx, dest, {
        freq, start: t0 + 0.28 + i * 0.08, dur: 0.09, peak: 0.09, voice: 'pulse', duty: 0.125,
      });
    });
    chipTone(ctx, dest, { freq: N.C3, start: t0, dur: 0.2, peak: 0.06, voice: 'triangle' });
    chipTone(ctx, dest, { freq: N.G3, start: t0 + 0.22, dur: 0.2, peak: 0.06, voice: 'triangle' });
    chipNoise(ctx, dest, { start: t0, dur: 0.022, peak: 0.04, filter: 4000 });
  },

  /** 3★ — полноценный victory fanfare (C major). */
  3: (ctx, t0) => {
    const dest = createMaster(ctx);
    const lead = [N.G4, N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, N.C6];
    lead.forEach((freq, i) => {
      chipTone(ctx, dest, {
        freq, start: t0 + i * 0.085, dur: 0.09, peak: 0.11, voice: 'pulse', duty: 0.25,
      });
    });
    chipArp(ctx, dest, [N.E5, N.G5, N.C6, N.G5], t0 + 0.5, 0.045, { duty: 0.125, peak: 0.07 });
    [N.C3, N.G3, N.C3, N.G3].forEach((freq, i) => {
      chipTone(ctx, dest, {
        freq, start: t0 + i * 0.17, dur: 0.16, peak: 0.065, voice: 'triangle',
      });
    });
    [0, 0.34, 0.68].forEach(t => {
      chipNoise(ctx, dest, { start: t0 + t, dur: 0.028, peak: 0.055, filter: 3200 });
    });
    chipTone(ctx, dest, {
      freq: N.C6, start: t0 + 0.72, dur: 0.28, peak: 0.1, voice: 'pulse', duty: 0.125, slide: N.G5,
    });
  },
};

const SEQUENCE_DURATIONS = {
  lesson: { 1: 520, 2: 720, 3: 1100 },
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
    const closeMs = opts.closeMs || 480;
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, closeMs);
  } catch (e) {}
}

export function playLessonCompleteSound(stars = 3, opts = {}) {
  const n = Math.min(3, Math.max(1, Number(stars) || 1));
  playSequence(LESSON_COMPLETE, n, { closeMs: SEQUENCE_DURATIONS.lesson[n], ...opts });
}

export function playLessonCompleteFromStore(_stars) {
  if (typeof document === 'undefined') return;
  import('../core/state.js').then(({ store }) => {
    const mode = normalizeAnswerSoundMode(store?.settings?.answerSoundMode);
    if (mode === 'none') return;
    playCupMelody(normalizeCupMelodyId(store?.settings?.cupMelody));
  }).catch(() => {});
}

export function playSuccessSound(melodyId = 'confirm-tap', opts = {}) {
  const meta = SUCCESS_MELODIES.find(m => m.id === normalizeSuccessSoundId(melodyId));
  if (!meta?.file) return;
  playMp3(meta.file, 'success', { gameplay: true, ...opts }, 0.85);
}

export function playFailSound(melodyId = 'load-fail', opts = {}) {
  const meta = FAIL_MELODIES.find(m => m.id === normalizeFailSoundId(melodyId));
  if (!meta?.file) return;
  playMp3(meta.file, 'fail', { gameplay: true, ...opts }, 0.85);
}

/** Разблокировать аудио ответов на жесте пользователя. */
export function unlockAnswerAudio(settings) {
  if (typeof document === 'undefined' || !settings) return;
  const mode = normalizeAnswerSoundMode(settings.answerSoundMode);
  if (shouldPlaySound(true, mode)) {
    const meta = SUCCESS_MELODIES.find(m => m.id === normalizeSuccessSoundId(settings.successSound));
    if (meta?.file) primeMp3(meta.file, 'success');
  }
  if (shouldPlaySound(false, mode)) {
    const meta = FAIL_MELODIES.find(m => m.id === normalizeFailSoundId(settings.failSound));
    if (meta?.file) primeMp3(meta.file, 'fail');
  }
}

export function unlockAnswerAudioFromStore() {
  if (typeof document === 'undefined') return;
  import('../core/state.js').then(({ store }) => {
    unlockAnswerAudio(store?.settings);
  }).catch(() => {});
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
