import type { Settings } from "../data/types.js"

/** Groq Orpheus — neural TTS для английского (canopylabs/orpheus-v1-english). */

export const ORPHEUS_MODEL = "canopylabs/orpheus-v1-english"
export const ORPHEUS_MAX_CHARS = 200
/** Одноразовое принятие terms модели в Groq Console. */
export const ORPHEUS_TERMS_URL =
  "https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english"

export const ORPHEUS_VOICES = [
  { id: "hannah", label: "Hannah", gender: "female", hint: "нейтральный женский" },
  { id: "autumn", label: "Autumn", gender: "female", hint: "тёплый женский" },
  { id: "diana", label: "Diana", gender: "female", hint: "чёткий женский" },
  { id: "troy", label: "Troy", gender: "male", hint: "нейтральный мужской" },
  { id: "austin", label: "Austin", gender: "male", hint: "мягкий мужской" },
  { id: "daniel", label: "Daniel", gender: "male", hint: "уверенный мужской" }
]

const VOICE_IDS = new Set(ORPHEUS_VOICES.map((v) => v.id))

export function normalizeOrpheusVoice(id: string | null | undefined) {
  const v = String(id || "")
    .trim()
    .toLowerCase()
  return VOICE_IDS.has(v) ? v : "hannah"
}

export function orpheusVoiceLabel(id: string | null | undefined) {
  return ORPHEUS_VOICES.find((v) => v.id === normalizeOrpheusVoice(id))?.label || "Hannah"
}

export function isEnglishLang(lang: string | null | undefined) {
  return String(lang || "")
    .toLowerCase()
    .startsWith("en")
}

/** Включён ли Orpheus для английского в настройках. */
export function orpheusEnabled(settings: Settings | null | undefined) {
  return settings?.ttsOrpheus === true
}

export function truncateForOrpheus(text: string | null | undefined) {
  const t = String(text || "").trim()
  if (t.length <= ORPHEUS_MAX_CHARS) return t
  let cut = t.slice(0, ORPHEUS_MAX_CHARS)
  const lastSpace = cut.lastIndexOf(" ")
  if (lastSpace > ORPHEUS_MAX_CHARS * 0.65) cut = cut.slice(0, lastSpace)
  return cut.trim()
}

/** Понятное сообщение из сырого ответа Groq. */
export function formatOrpheusError(raw: unknown) {
  const msg = String(raw || "").trim()
  if (!msg) return "Orpheus недоступен"
  if (/terms acceptance|accept the terms/i.test(msg)) {
    return "Примите условия модели Orpheus в Groq Console — ссылка в подсказке ниже"
  }
  if (/invalid api key|unauthorized/i.test(msg)) {
    return "Неверный Groq API ключ"
  }
  if (/rate limit|limit exceeded|quota/i.test(msg)) {
    return "Исчерпан дневной лимит Groq для Orpheus (~100 запросов)"
  }
  return msg.length > 140 ? msg.slice(0, 137) + "…" : msg
}

export function isOrpheusTermsError(raw: unknown) {
  return /terms acceptance|accept the terms/i.test(String(raw || ""))
}
