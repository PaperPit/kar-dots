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

function primeMp3(file, slot) {
  if (typeof Audio === 'undefined') return;
  try {
    let audio = mp3Audio[slot];
    if (!audio || audio.__soundFile !== file) {
      audio = new Audio(file);
      audio.__soundFile = file;
      mp3Audio[slot] = audio;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.muted = true;
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }).catch(() => {
      audio.muted = false;
    });
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

function shouldPlaySound(isCorrect, mode) {
  const m = normalizeAnswerSoundMode(mode);
  if (m === 'none') return false;
  if (isCorrect) return m === 'both' || m === 'correct';
  return m === 'both' || m === 'wrong';
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

/** Остановить MP3-звуки ответов (освободить аудио-сессию перед микрофоном). */
export function stopAnswerAudio() {
  Object.values(mp3Audio).forEach((audio) => {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  });
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
  const mode = normalizeAnswerSoundMode(settings.answerSoundMode);
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
