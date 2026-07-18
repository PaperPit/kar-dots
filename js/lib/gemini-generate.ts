/** Ошибки Gemini при генерации карточек (yt-generate). */

export function formatGeminiGenerateError(raw: unknown, status?: number) {
  const msg = String(raw || "").trim()
  if (!msg) {
    return status === 429 ? "Квота Gemini исчерпана" : `Gemini недоступен (${status || "ошибка"})`
  }
  if (/api key not valid|invalid api key|API_KEY_INVALID/i.test(msg)) {
    return "Неверный Gemini API ключ — создай новый в Google AI Studio"
  }
  if (/permission|API has not been used|not enabled/i.test(msg)) {
    return "Включи Generative Language API для ключа в Google Cloud Console"
  }
  if (/quota|rate limit|resource exhausted/i.test(msg) || status === 429) {
    return "Квота Gemini исчерпана — попробуй позже"
  }
  if (/model.*not found|no longer available|is not supported/i.test(msg)) {
    return "Модель Gemini недоступна — обнови приложение или задай GEMINI_MODEL на сервере"
  }
  return msg.length > 140 ? msg.slice(0, 137) + "…" : msg
}

export function combineLlmErrors(geminiMessage: unknown, groqMessage: unknown) {
  const g = String(geminiMessage || "").trim()
  const q = String(groqMessage || "").trim()
  if (g && q) return `Gemini: ${g} Groq (резерв): ${q}`
  return g || q || "Не удалось сгенерировать карточки"
}
