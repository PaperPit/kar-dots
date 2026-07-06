const MODES = new Set(['flip', 'type', 'voice', 'match', 'combo']);
const STORAGE_KEY = 'kar_last_study_mode';
const SESSION_KEY = 'kar_session_study_mode';
const PROMPT_SIDE_KEY = 'kar_last_prompt_side';
const SESSION_PROMPT_SIDE_KEY = 'kar_session_prompt_side';
const SESSION_CRAM_LIMIT_KEY = 'kar_session_cram_limit';
const CRAM_LIMIT_KEY = 'kar_last_cram_limit';

export const PROMPT_SIDE_META = [
  { id: 'front', label: 'Лицо', desc: 'Видите термин — вводите или говорите перевод' },
  { id: 'back', label: 'Оборот', desc: 'Видите перевод — вводите или говорите термин' },
];

export const STUDY_MODE_META = [
  { id: 'flip', title: 'Классический', desc: 'Переворот карточки и свайп «Знаю / Не знаю»' },
  { id: 'type', title: 'Ввод', desc: 'Напечатать перевод или ответ' },
  { id: 'voice', title: 'Голос', desc: 'Сказать перевод в микрофон' },
  { id: 'combo', title: 'Микс', desc: 'Случайно: ввод, голос или 5 пар слов' },
  { id: 'match', title: 'Пары', desc: 'Собрать термины и переводы в пары' },
];

export function isStudyMode(v) {
  return MODES.has(v);
}

export function parseReviewRoute(parts) {
  let folderId = null;
  let cram = false;
  let mode = 'flip';
  let cramLimit = null;
  const rest = parts.slice(1);
  if (!rest.length) return { folderId, cram, mode, cramLimit };

  let i = 0;
  const first = rest[0];
  if (MODES.has(first)) {
    return { folderId: null, cram: false, mode: first, cramLimit: null };
  }

  folderId = first;
  i = 1;

  if (rest[i] === 'cram') {
    cram = true;
    i += 1;
    if (rest[i] && /^\d+$/.test(rest[i])) {
      cramLimit = parseInt(rest[i], 10);
      i += 1;
    }
    if (rest[i] && MODES.has(rest[i])) mode = rest[i];
  } else if (rest[i] && MODES.has(rest[i])) {
    mode = rest[i];
  }

  return { folderId, cram, mode, cramLimit };
}

export function buildReviewHash(folderId, { cram = false, mode = 'flip', cramLimit = null } = {}) {
  const segs = ['review'];
  if (folderId) segs.push(folderId);
  if (cram) segs.push('cram');
  if (cram && cramLimit != null && cramLimit > 0) segs.push(String(cramLimit));
  if (mode && mode !== 'flip') segs.push(mode);
  return '#' + segs.join('/');
}

export function getLastStudyMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.has(v) ? v : 'flip';
  } catch (e) {
    return 'flip';
  }
}

export function setLastStudyMode(mode) {
  if (!MODES.has(mode)) return;
  try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) {}
}

/** Режим текущей сессии — надёжнее hash при переходе из picker. */
export function setSessionStudyMode(mode) {
  if (!MODES.has(mode)) return;
  try { sessionStorage.setItem(SESSION_KEY, mode); } catch (e) {}
}

export function resolveStudyMode(urlMode) {
  const fromUrl = MODES.has(urlMode) ? urlMode : 'flip';
  try {
    const pending = sessionStorage.getItem(SESSION_KEY);
    if (pending && MODES.has(pending)) {
      sessionStorage.removeItem(SESSION_KEY);
      return pending;
    }
  } catch (e) {}
  if (fromUrl !== 'flip') return fromUrl;
  const last = getLastStudyMode();
  if (last && last !== 'flip') return last;
  return 'flip';
}

export function studyModeLabel(mode) {
  return STUDY_MODE_META.find(m => m.id === mode)?.title || 'Классический';
}

export function promptSideLabel(side) {
  return PROMPT_SIDE_META.find(s => s.id === side)?.label || 'Лицо';
}

export function normalizePromptSide(side) {
  return side === 'back' ? 'back' : 'front';
}

export function getLastPromptSide() {
  try {
    const v = localStorage.getItem(PROMPT_SIDE_KEY);
    return v === 'back' ? 'back' : 'front';
  } catch (e) {
    return 'front';
  }
}

export function setLastPromptSide(side) {
  const s = normalizePromptSide(side);
  try { localStorage.setItem(PROMPT_SIDE_KEY, s); } catch (e) {}
}

export function setSessionPromptSide(side) {
  const s = normalizePromptSide(side);
  try { sessionStorage.setItem(SESSION_PROMPT_SIDE_KEY, s); } catch (e) {}
  setLastPromptSide(s);
}

/** Считывает сторону сессии закрепления (один раз при старте). */
export function consumeSessionPromptSide() {
  try {
    const v = sessionStorage.getItem(SESSION_PROMPT_SIDE_KEY);
    sessionStorage.removeItem(SESSION_PROMPT_SIDE_KEY);
    return v === 'back' ? 'back' : v === 'front' ? 'front' : null;
  } catch (e) {
    return null;
  }
}

export function getLastCramLimit() {
  try {
    const v = localStorage.getItem(CRAM_LIMIT_KEY);
    if (v === '' || v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (e) {
    return null;
  }
}

export function setLastCramLimit(limit) {
  try {
    if (limit == null || limit <= 0) localStorage.removeItem(CRAM_LIMIT_KEY);
    else localStorage.setItem(CRAM_LIMIT_KEY, String(limit));
  } catch (e) {}
}

/** Лимит карточек для закрепления (null = все). Считывается один раз при старте. */
export function setSessionCramLimit(limit) {
  try {
    if (limit == null || limit <= 0) sessionStorage.removeItem(SESSION_CRAM_LIMIT_KEY);
    else sessionStorage.setItem(SESSION_CRAM_LIMIT_KEY, String(limit));
    setLastCramLimit(limit);
  } catch (e) {}
}

export function consumeSessionCramLimit() {
  try {
    const v = sessionStorage.getItem(SESSION_CRAM_LIMIT_KEY);
    sessionStorage.removeItem(SESSION_CRAM_LIMIT_KEY);
    if (v === '' || v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (e) {
    return null;
  }
}
