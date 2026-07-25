/** Валидация API-ключей для Cloudflare Pages Functions (без секретов в коде). */

/** Groq / Orpheus TTS: только ключ из запроса клиента. */
export function cleanGroqApiKey(raw) {
  const s = String(raw || "").trim()
  return /^[A-Za-z0-9_-]{20,200}$/.test(s) ? s : ""
}

export function normalizeOrpheusVoice(v, allowed = null) {
  const voices = allowed || new Set(["autumn", "diana", "hannah", "austin", "daniel", "troy"])
  const id = String(v || "hannah").trim().toLowerCase()
  return voices.has(id) ? id : "hannah"
}

/** Pixabay: `digits-alphanum` или длинная строка с дефисом. */
export function cleanPixabayApiKey(raw) {
  const s = String(raw || "").trim()
  if (!s) return ""
  if (/^[0-9]+-[A-Za-z0-9_-]{10,128}$/.test(s)) return s
  if (s.length >= 20 && s.includes("-")) return s
  return ""
}

/** Giphy: alphanumeric 16–128. */
export function cleanGiphyApiKey(raw) {
  const s = String(raw || "").trim()
  return /^[A-Za-z0-9]{16,128}$/.test(s) ? s : ""
}
