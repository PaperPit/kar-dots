/** Groq Chat — генерация карточек из YouTube (yt-generate.mjs). */

export const GROQ_LIMITS_URL = "https://console.groq.com/settings/project/limits"

/** Порядок: сначала актуальные модели Groq, затем legacy Llama. */
export const GROQ_GENERATE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant"
]

/**
 * @param {string} [envModel] — GROQ_MODEL или явный override
 * @returns {string[]}
 */
export function groqModelsToTry(envModel: string | undefined) {
  const preferred = String(envModel || "").trim()
  const chain = preferred ? [preferred] : []
  for (const id of GROQ_GENERATE_MODELS) {
    if (!chain.includes(id)) chain.push(id)
  }
  return chain
}

export function isGroqModelBlocked(raw: unknown) {
  return /blocked at the project level|enable this model in the project settings/i.test(
    String(raw || "")
  )
}

export function isGroqModelUnavailable(raw: unknown) {
  const msg = String(raw || "").toLowerCase()
  return (
    isGroqModelBlocked(raw) ||
    /model.*not found|does not exist|unknown model|decommissioned|deprecated/i.test(msg)
  )
}

/** Стоит ли попробовать следующую модель в цепочке. */
export function shouldTryNextGroqModel(status: number | undefined, rawMessage: unknown) {
  if (status === 429) return false
  if (status === 401 || status === 403) return false
  if (isGroqModelUnavailable(rawMessage)) return true
  if (status === 404) return true
  return false
}

export function formatGroqGenerateError(raw: unknown) {
  const msg = String(raw || "").trim()
  if (!msg) return "Groq не смог сгенерировать карточки"
  if (isGroqModelBlocked(msg)) {
    return "Все модели Groq отключены в вашем проекте. В Groq Console → Project → Limits включите GPT OSS или добавьте Gemini ключ (основной провайдер)."
  }
  if (/invalid api key|unauthorized/i.test(msg)) {
    return "Неверный Groq API ключ"
  }
  if (/rate limit|limit exceeded|quota/i.test(msg)) {
    return "Исчерпан лимит Groq — попробуйте позже или используйте Gemini"
  }
  return msg.length > 160 ? msg.slice(0, 157) + "…" : msg
}
