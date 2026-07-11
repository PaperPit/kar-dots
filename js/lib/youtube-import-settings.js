/**
 * Личные API-ключи для «Карточки из YouTube» (Настройки → Карточки из YouTube).
 * Ключ из настроек имеет приоритет; если поле пустое, серверные функции
 * используют общий ключ из переменных окружения Netlify (если он настроен).
 */

export function getGeminiApiKey(settings) {
  return String(settings?.geminiApiKey || '').trim();
}

export function hasGeminiApiKey(settings) {
  return getGeminiApiKey(settings).length > 0;
}

export function getGroqApiKey(settings) {
  return String(settings?.groqApiKey || '').trim();
}

export function hasGroqApiKey(settings) {
  return getGroqApiKey(settings).length > 0;
}

/** Добавляет к телу запроса /api/* личные ключи — только те, что заданы. */
export function withApiKeys(settings, body) {
  const out = { ...body };
  const gemini = getGeminiApiKey(settings);
  if (gemini) out.geminiApiKey = gemini;
  const groq = getGroqApiKey(settings);
  if (groq) out.groqApiKey = groq;
  return out;
}
