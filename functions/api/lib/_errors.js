// Общие правила ошибок для /api/*.
//
// Наружу отдаём только СВОЙ текст на русском + стабильный код ошибки.
// Тело ответа апстрима (Supadata / Gemini / Groq / Pixabay / Giphy) может
// содержать чужие сообщения, идентификаторы и куски ключей — его пишем
// в console.error и никогда не отражаем анонимному вызывающему.

/** AbortSignal.timeout(...) → DOMException 'TimeoutError'; ручной abort → 'AbortError'. */
export function isTimeoutError(e) {
  const name = e?.name || '';
  return name === 'TimeoutError' || name === 'AbortError';
}

/** Русское сообщение для 504 по имени апстрима. */
export function timeoutMessage(upstream) {
  return `${upstream} не ответил вовремя — попробуй ещё раз`;
}

/**
 * Форматтеры из js/lib (formatGeminiGenerateError и др.) распознают частые
 * случаи и дают свой русский текст, а иначе просто обрезают СЫРОЙ ответ
 * апстрима. Такой «просочившийся» текст наружу не отдаём.
 */
export function isCuratedMessage(formatted, raw) {
  const f = String(formatted || '').trim();
  const r = String(raw || '').trim();
  if (!f) return false;
  if (!r) return true;
  if (f === r) return false;
  const cut = f.endsWith('…') ? f.slice(0, -1) : f;
  return !(cut && r.startsWith(cut));
}

/** Готовое сообщение форматтера либо общий текст, если это эхо апстрима. */
export function safeUpstreamMessage(formatted, raw, fallback) {
  return isCuratedMessage(formatted, raw) ? String(formatted).trim() : fallback;
}

/** Единая точка логирования апстрим-ошибок (в ответ клиенту это не попадает). */
export function logUpstream(scope, detail, extra) {
  const text = String(detail?.message || detail || '').slice(0, 500);
  if (extra === undefined) console.error(`[${scope}] upstream:`, text);
  else console.error(`[${scope}] upstream:`, text, extra);
}
