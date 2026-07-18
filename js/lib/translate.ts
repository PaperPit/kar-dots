const API = 'https://api.mymemory.translated.net/get';
const PAUSE_MS = 320;

function langPair(from, to) {
  return `${from}|${to}`;
}

function parseDir(dir) {
  if (dir === 'en-ru') return { from: 'en', to: 'ru' };
  return { from: 'ru', to: 'en' };
}

const DIR_LABELS = { 'ru-en': 'RU → EN', 'en-ru': 'EN → RU' };

export function translateDirLabel(dir) {
  return DIR_LABELS[dir] || DIR_LABELS['ru-en'];
}

export function flipTranslateDir(dir) {
  return dir === 'en-ru' ? 'ru-en' : 'en-ru';
}

export function getTranslateDir() {
  try {
    const v = localStorage.getItem('kar_translate_dir');
    return v === 'en-ru' ? 'en-ru' : 'ru-en';
  } catch (e) {
    return 'ru-en';
  }
}

export function setTranslateDir(dir) {
  try { localStorage.setItem('kar_translate_dir', dir); } catch (e) {}
}

export async function translateText(text, dir = getTranslateDir()) {
  const q = String(text || '').trim();
  if (!q) throw new Error('Нечего переводить');
  const { from, to } = parseDir(dir);
  const url = `${API}?q=${encodeURIComponent(q)}&langpair=${langPair(from, to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Сервис перевода недоступен');
  const data = await res.json();
  const out = data?.responseData?.translatedText?.trim();
  if (!out) throw new Error('Перевод не получен');
  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Лимит перевода исчерпан, попробуйте позже');
  }
  return out;
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Перевод списка слов с паузой между запросами. */
export async function translateBatch(words, dir, onProgress) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    try {
      const t = await translateText(w, dir);
      out.push({ front: w, back: t });
    } catch (e) {
      out.push({ front: w, back: '', error: e.message });
    }
    if (onProgress) onProgress(i + 1, words.length);
    if (i < words.length - 1) await sleep(PAUSE_MS);
  }
  return out;
}
