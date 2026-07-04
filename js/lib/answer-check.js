import { stripHtml } from '../ui/ui.js';

const PUNCT_RE = /[.,!?;:'"«»\-—_()[\]{}？！…·]/g;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

export function normalizeAnswer(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(ZERO_WIDTH_RE, '')
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(PUNCT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plainText(html) {
  if (typeof document === 'undefined') {
    return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
  return stripHtml(html);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Расширяет русские формы: занятой → занят; скучать → скучаю */
export function expandRussianVariants(variant) {
  const v = normalizeAnswer(variant);
  if (!v) return [];
  const out = new Set([v]);

  // прилагательные на -ой/-ий/-ый
  const adj = v.match(/^(.+?)(ой|ий|ый|ая|ое|ые)$/);
  if (adj) {
    const stem = adj[1];
    const suf = adj[2];
    if (suf === 'ой' || suf === 'ий' || suf === 'ый') {
      out.add(stem);
      out.add(`${stem}ая`);
      out.add(`${stem}ое`);
      out.add(`${stem}ые`);
      out.add(`${stem}а`);
      out.add(`${stem}о`);
      out.add(`${stem}ы`);
    }
    if (suf === 'ая') {
      out.add(stem);
      out.add(`${stem}ой`);
      out.add(`${stem}ое`);
    }
  }

  // глаголы: промахнуться → промах, промахнуть
  if (v.endsWith('нуться')) {
    out.add(v.slice(0, -2));
    out.add(v.slice(0, -4));
  }
  if (v.endsWith('ть') && v.length > 3) {
    out.add(v.slice(0, -2));
  }

  return [...out];
}

export function cardHasCheckableBack(card) {
  return cardHasCheckableAnswer(card, 'front');
}

export function cardHasCheckableAnswer(card, promptSide = 'front') {
  const raw = promptSide === 'front' ? card?.back : card?.front;
  return !!plainText(raw || '').trim();
}

export function getExpectedAnswer(card, promptSide) {
  const raw = promptSide === 'front' ? card.back : card.front;
  return plainText(raw || '').trim();
}

/** Разбивает ответ на варианты: слэш, точка с запятой, запятая, вертикальная черта */
export function expectedVariants(expected) {
  return String(expected || '')
    .split(/[/;|,]/)
    .map(v => normalizeAnswer(v))
    .filter(Boolean);
}

/** Все принимаемые формы с учётом морфологии */
export function allAcceptedForms(expected) {
  const forms = new Set();
  for (const v of expectedVariants(expected)) {
    for (const f of expandRussianVariants(v)) {
      forms.add(f);
    }
  }
  return forms;
}

/** Текст для показа пользователю: все принимаемые варианты */
export function formatExpectedDisplay(expected) {
  const variants = expectedVariants(expected);
  if (!variants.length) return '';
  if (variants.length === 1) return variants[0];
  return variants.join(' / ');
}

export function answersMatch(given, expected, opts = {}) {
  const g = normalizeAnswer(given);
  if (!g) return false;
  const variants = expectedVariants(expected);
  if (!variants.length) return false;

  const accepted = opts.russianMorphology !== false
    ? allAcceptedForms(expected)
    : new Set(variants);

  for (const v of accepted) {
    if (g === v) return true;
    if (opts.fuzzy && similarity(g, v) >= (opts.fuzzyThreshold ?? 0.8)) return true;
  }
  return false;
}

export function checkCardAnswer(given, card, promptSide, opts = {}) {
  const expected = getExpectedAnswer(card, promptSide);
  if (!expected) return { ok: false, expected: '' };
  return {
    ok: answersMatch(given, expected, opts),
    expected,
  };
}
