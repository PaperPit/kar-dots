/**
 * Авто-cloze: пропуск 1–2 букв в словах ответа (без ИИ).
 * Количество пропусков зависит от длины слова; фразы — по словам.
 */

const LETTER = /[\p{L}]/u;
const WORD_RE = /^([^\p{L}]*)([\p{L}][\p{L}''-]*[\p{L}]|[\p{L}])([^\p{L}]*)$/u;

/** Сколько букв пропустить в слове по числу букв (не символов). */
export function clozeLettersToHide(letterCount) {
  if (letterCount <= 1) return 0;
  if (letterCount <= 4) return 1;
  return 2;
}

function countLetters(word) {
  let n = 0;
  for (const ch of word) if (LETTER.test(ch)) n++;
  return n;
}

function letterIndices(word) {
  const out = [];
  for (let i = 0; i < word.length; i++) {
    if (LETTER.test(word[i])) out.push(i);
  }
  return out;
}

/** Детерминированный PRNG для стабильного cloze в рамках одной карточки. */
export function clozeSeed(text, salt = '') {
  let h = 2166136261;
  const s = String(text || '') + '|' + String(salt || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickHiddenIndices(indices, count, rng) {
  if (!indices.length || count <= 0) return [];
  const hide = Math.min(count, indices.length);
  let pool = indices;
  if (indices.length > 2) {
    const inner = indices.filter((_, i) => i > 0 && i < indices.length - 1);
    if (inner.length >= hide) pool = inner;
  }
  const shuffled = [...pool].sort(() => rng() - 0.5);
  return shuffled.slice(0, hide).sort((a, b) => a - b);
}

function clozeWord(word, rng) {
  const n = countLetters(word);
  const hide = clozeLettersToHide(n);
  if (hide <= 0) {
    return { word, hidden: [], display: word };
  }
  const idx = letterIndices(word);
  const hidden = pickHiddenIndices(idx, hide, rng);
  if (!hidden.length) {
    return { word, hidden: [], display: word };
  }
  const hiddenSet = new Set(hidden);
  let display = '';
  for (let i = 0; i < word.length; i++) {
    display += hiddenSet.has(i) ? '_' : word[i];
  }
  return { word, hidden, display };
}

/**
 * Строит cloze для ответа (слово или фраза).
 * @returns {{ segments: { type: 'char', ch: string, hidden?: boolean }[], plain: string, hasBlanks: boolean }}
 */
export function buildClozeText(text, { seed } = {}) {
  const raw = String(text || '');
  const rng = mulberry32(typeof seed === 'number' ? seed : clozeSeed(raw));
  const segments = [];
  let plain = '';
  let hasBlanks = false;
  let wordIdx = 0;

  const parts = raw.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      for (const ch of part) {
        segments.push({ type: 'char', ch });
        plain += ch;
      }
      continue;
    }

    const m = part.match(WORD_RE);
    if (!m) {
      for (const ch of part) {
        segments.push({ type: 'char', ch });
        plain += ch;
      }
      continue;
    }

    const [, pre, word, post] = m;
    for (const ch of pre) {
      segments.push({ type: 'char', ch });
      plain += ch;
    }

    const wordRng = mulberry32(clozeSeed(word, String(wordIdx++)));
    const { display, hidden } = clozeWord(word, wordRng);
    const hiddenSet = new Set(hidden);
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (hiddenSet.has(i)) {
        segments.push({ type: 'char', ch: '_', hidden: true, answer: ch });
        plain += '_';
        hasBlanks = true;
      } else {
        segments.push({ type: 'char', ch });
        plain += ch;
      }
    }

    for (const ch of post) {
      segments.push({ type: 'char', ch });
      plain += ch;
    }
  }

  return { segments, plain, hasBlanks };
}

/** Можно ли построить cloze для этого ответа (есть слово с ≥2 буквами). */
export function canBuildCloze(text) {
  const parts = String(text || '').split(/(\s+)/);
  for (const part of parts) {
    const m = part.match(WORD_RE);
    if (!m) continue;
    if (clozeLettersToHide(countLetters(m[2])) > 0) return true;
  }
  return false;
}
