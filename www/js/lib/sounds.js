import { store } from '../core/state.js';

export const SUCCESS_MELODIES = [
  { id: 'clear-combo', label: 'Готово', file: 'audio/success/clear-combo.mp3' },
  { id: 'ui-pop', label: 'Щелчок', file: 'audio/success/ui-pop.mp3' },
  { id: 'soft-plopp', label: 'Отметка', file: 'audio/success/soft-plopp.mp3' },
  { id: 'ui-notification', label: 'Пинг', file: 'audio/success/ui-notification.mp3' },
  { id: 'confirm-tap', label: 'Динь', file: 'audio/success/confirm-tap.mp3' },
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
  { id: 'game-button', label: 'Нет', file: 'audio/fail/game-button.mp3' },
  { id: 'sword-cut', label: 'Тук', file: 'audio/fail/sword-cut.mp3' },
  { id: 'short-fail', label: 'Брр', file: 'audio/fail/short-fail.mp3' },
  { id: 'glitch-error', label: 'Увы', file: 'audio/fail/glitch-error.mp3' },
  { id: 'load-fail', label: 'Спад', file: 'audio/fail/load-fail.mp3' },
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
  { id: 'level-up', label: 'Новый уровень', file: 'audio/level-up.mp3' },
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
  return SUCCESS_MELODIES.find(m => m.id === normalizeSuccessSoundId(id))?.label || 'Динь';
}

export function failSoundLabel(id) {
  return FAIL_MELODIES.find(m => m.id === normalizeFailSoundId(id))?.label || 'Спад';
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

/** Обратная мапа MP3-id → id синтезированной мелодии (fallback без файлов). */
function synthSuccessId(mp3Id) {
  for (const [legacy, modern] of Object.entries(LEGACY_SUCCESS)) {
    if (modern === mp3Id) return legacy;
  }
  return 'chime';
}

function synthFailId(mp3Id) {
  for (const [legacy, modern] of Object.entries(LEGACY_FAIL)) {
    if (modern === mp3Id) return legacy;
  }
  return 'drop';
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

function shouldReduceSound(opts = {}) {
  if (opts.preview || opts.gameplay || opts.interaction) return false;
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

let sharedCtx = null;

/** Разблокировать Web Audio на жесте пользователя (нужно для synth-fallback и превью). */
export function ensureAudioUnlocked() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctx();
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch (e) {
    return null;
  }
}

function playSequence(sequences, id, opts = {}) {
  if (shouldReduceSound(opts)) return;
  const play = sequences[id] || sequences[Object.keys(sequences)[0]];
  const ctx = ensureAudioUnlocked();
  if (!ctx) return;
  try {
    const start = () => play(ctx, ctx.currentTime);
    if (ctx.state === 'suspended') ctx.resume().then(start).catch(() => {});
    else start();
  } catch (e) {}
}

function playSynthSuccess(mp3Id, opts = {}) {
  playSequence(SUCCESS_SEQUENCES, synthSuccessId(mp3Id), opts);
}

function playSynthFail(mp3Id, opts = {}) {
  playSequence(FAIL_SEQUENCES, synthFailId(mp3Id), opts);
}

function resolveSoundUrl(file) {
  if (typeof document === 'undefined') return file;
  try { return new URL(file, document.baseURI).href; }
  catch (e) { return file; }
}

let mp3Audio = { success: null, fail: null, cup: null, uiClick: null };

function playMp3(file, slot, opts = {}, volume = 0.85, onFail) {
  if (typeof Audio === 'undefined') {
    if (onFail) onFail();
    return;
  }
  if (shouldReduceSound(opts)) return;
  ensureAudioUnlocked();

  let failed = false;
  const failOnce = () => {
    if (failed) return;
    failed = true;
    if (onFail) onFail();
  };

  try {
    const url = resolveSoundUrl(file);
    const fresh = !!opts.preview;
    let audio = fresh ? null : mp3Audio[slot];
    if (!audio || audio.__soundFile !== url) {
      audio = new Audio(url);
      audio.__soundFile = url;
      if (!fresh) mp3Audio[slot] = audio;
    }

    let started = false;
    const start = () => {
      if (failed) return;
      started = true;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      audio.play().catch(failOnce);
    };

    audio.onerror = failOnce;

    if (fresh && audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      audio.addEventListener('canplay', start, { once: true });
      audio.load();
      setTimeout(() => {
        if (!started && audio.paused) failOnce();
      }, 700);
    } else {
      start();
    }
  } catch (e) {
    failOnce();
  }
}

function primeMp3(file, slot, volume = 0.001) {
  if (typeof Audio === 'undefined') return;
  try {
    const url = resolveSoundUrl(file);
    let audio = mp3Audio[slot];
    if (!audio || audio.__soundFile !== url) {
      audio = new Audio(url);
      audio.__soundFile = url;
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

export function playUiClickSound(melodyId = 'none', opts = {}) {
  const id = normalizeUiClickSoundId(melodyId);
  if (id === 'none') return;
  const meta = UI_CLICK_MELODIES.find(m => m.id === id);
  if (!meta?.file) return;
  playMp3(meta.file, 'uiClick', { interaction: true, ...opts }, 0.65);
}

/** Проиграть MP3 при появлении кубка. */
export function playCupMelody(melodyId = 'show-alert', opts = {}) {
  const meta = CUP_MELODIES.find(m => m.id === normalizeCupMelodyId(melodyId));
  if (!meta) return;
  const stamped = { gameplay: true, ...opts };
  playMp3(meta.file, 'cup', stamped, 0.9, () => playSynthSuccess('confirm-tap', stamped));
}

function shouldPlaySound(isCorrect, mode) {
  const m = normalizeAnswerSoundMode(mode);
  if (m === 'none') return false;
  if (isCorrect) return m === 'both' || m === 'correct';
  return m === 'both' || m === 'wrong';
}

export function playLessonCompleteFromStore(_stars) {
  if (typeof document === 'undefined') return;
  const mode = normalizeAnswerSoundMode(store?.settings?.answerSoundMode);
  if (mode === 'none') return;
  playCupMelody(normalizeCupMelodyId(store?.settings?.cupMelody));
}

export function playSuccessSound(melodyId = 'confirm-tap', opts = {}) {
  const id = normalizeSuccessSoundId(melodyId);
  const meta = SUCCESS_MELODIES.find(m => m.id === id);
  const stamped = { gameplay: true, ...opts };
  const fallback = () => playSynthSuccess(id, stamped);
  if (!meta?.file) { fallback(); return; }
  playMp3(meta.file, 'success', stamped, 0.85, fallback);
}

export function playFailSound(melodyId = 'load-fail', opts = {}) {
  const id = normalizeFailSoundId(melodyId);
  const meta = FAIL_MELODIES.find(m => m.id === id);
  const stamped = { gameplay: true, ...opts };
  const fallback = () => playSynthFail(id, stamped);
  if (!meta?.file) { fallback(); return; }
  playMp3(meta.file, 'fail', stamped, 0.85, fallback);
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
  unlockAnswerAudio(store?.settings);
}

export function playAnswerFeedback(isCorrect, settings) {
  if (!settings) return;
  const mode = normalizeAnswerSoundMode(settings.answerSoundMode);
  if (!shouldPlaySound(isCorrect, mode)) return;
  if (isCorrect) playSuccessSound(settings.successSound);
  else playFailSound(settings.failSound);
}

/** Синхронный вызов — важно для iOS: звук должен стартовать в том же жесте, что и клик. */
export function playAnswerFeedbackFromStore(isCorrect) {
  playAnswerFeedback(isCorrect, store?.settings);
}
