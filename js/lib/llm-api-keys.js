/** Нормализация личных API-ключей (YouTube-импорт, TTS). */

function strip(raw) {
  return String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, '');
}

/** Классический AI Studio (Standard) или новый Auth key (AQ.). */
const GEMINI_KEY_RE = /^(?:AIza[A-Za-z0-9_-]{10,}|AQ\.[A-Za-z0-9._-]{20,})$/;

export function cleanGeminiApiKey(raw) {
  const s = strip(raw);
  if (!s) return '';
  if (GEMINI_KEY_RE.test(s)) return s.slice(0, 512);
  // Новые Auth keys (2026+): AQ. + base64url-подобная строка
  if (/^AQ\./.test(s) && s.length >= 24 && s.length <= 512 && /^[A-Za-z0-9._-]+$/.test(s)) {
    return s;
  }
  if (/^AIza/.test(s) && s.length >= 20 && s.length <= 512 && /^[A-Za-z0-9_-]+$/.test(s)) {
    return s;
  }
  return '';
}

export function isGeminiApiKeyFormat(value) {
  return !!cleanGeminiApiKey(value);
}

export function cleanGroqApiKey(raw) {
  const s = strip(raw);
  if (!s) return '';
  if (/^gsk_[A-Za-z0-9_-]{10,200}$/.test(s)) return s;
  if (/^[A-Za-z0-9_-]{20,200}$/.test(s)) return s;
  return '';
}

export function cleanSupadataApiKey(raw) {
  const s = strip(raw);
  if (!s) return '';
  if (/^sd_[A-Za-z0-9_-]{10,200}$/.test(s)) return s;
  if (/^[A-Za-z0-9_-]{16,200}$/.test(s)) return s;
  return '';
}

/** @deprecated используй cleanGroqApiKey / cleanGeminiApiKey */
export function cleanApiKey(raw) {
  return cleanGroqApiKey(raw) || cleanGeminiApiKey(raw);
}
