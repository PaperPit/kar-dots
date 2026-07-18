/** Browser Speech Synthesis API — голоса, выбор языка, авто-подбор. */

export interface SpeechVoiceLike {
  name: string
  lang: string
  voiceURI: string
  localService?: boolean
  default?: boolean
}

/** Кириллица → ru-RU, латиница → en-US, иначе ru-RU. */
export function detectSpeechLang(text: string): string {
  const t = String(text || "")
  if (/[\u0400-\u04FF]/.test(t)) return "ru-RU"
  if (/[a-zA-Z]/.test(t)) return "en-US"
  return "ru-RU"
}

/** @param {string} lang */
export function speechLangPrefix(lang: string): "en" | "ru" {
  return String(lang || "")
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "ru"
}

/** @param {SpeechVoiceLike} voice */
export function scoreSpeechVoice(voice: SpeechVoiceLike): number {
  let score = 0
  const name = String(voice.name || "")
  if (/premium|enhanced|google|neural|natural|wavenet/i.test(name)) score += 4
  if (
    /samantha|daniel|karen|alex|moira|milena|yuri|anna|katya|dmitri|pavel|zira|david|mark/i.test(
      name
    )
  )
    score += 3
  if (voice.default) score += 1
  if (voice.localService) score += 1
  if (/compact|low|espeak|robot/i.test(name)) score -= 3
  return score
}

/**
 * @param {SpeechVoiceLike[]} voices
 * @param {'en'|'ru'} prefix
 */
export function pickBestSpeechVoice(
  voices: SpeechVoiceLike[],
  prefix: "en" | "ru" | string
): SpeechVoiceLike | null {
  const p = String(prefix || "ru").toLowerCase()
  const matching = voices.filter((v) =>
    String(v.lang || "")
      .toLowerCase()
      .startsWith(p)
  )
  if (!matching.length) return null
  return matching.slice().sort((a, b) => scoreSpeechVoice(b) - scoreSpeechVoice(a))[0] ?? null
}

/**
 * @param {SpeechVoiceLike[]} voices
 * @param {string} lang
 * @param {string} [preferredUri] — пусто = авто
 */
export function resolveSpeechVoice(
  voices: SpeechVoiceLike[],
  lang: string,
  preferredUri?: string
): SpeechVoiceLike | null {
  const prefix = speechLangPrefix(lang)
  const uri = String(preferredUri || "").trim()
  if (uri) {
    const found = voices.find((v) => v.voiceURI === uri)
    if (
      found &&
      String(found.lang || "")
        .toLowerCase()
        .startsWith(prefix)
    )
      return found
  }
  return pickBestSpeechVoice(voices, prefix)
}

/** @param {SpeechVoiceLike} voice */
export function formatSpeechVoiceLabel(voice: SpeechVoiceLike): string {
  const lang = String(voice.lang || "").replace("_", "-")
  const tag = voice.localService === false ? " · online" : ""
  return `${voice.name} (${lang})${tag}`
}

/**
 * @param {SpeechVoiceLike[]} voices
 * @param {'en'|'ru'} prefix
 */
export function listSpeechVoicesForLang(
  voices: SpeechVoiceLike[],
  prefix: "en" | "ru" | string
): SpeechVoiceLike[] {
  const p = String(prefix || "ru").toLowerCase()
  return voices
    .filter((v) =>
      String(v.lang || "")
        .toLowerCase()
        .startsWith(p)
    )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
}

let cachedVoices: SpeechVoiceLike[] = []

export function speechSynthesisSupported(): boolean {
  return typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined"
}

export function getSpeechVoices(): SpeechVoiceLike[] {
  if (!speechSynthesisSupported()) return cachedVoices.slice()
  const live = speechSynthesis.getVoices()
  if (live.length) cachedVoices = live
  return cachedVoices.slice()
}

function refreshSpeechVoices(): void {
  if (!speechSynthesisSupported()) return
  const live = speechSynthesis.getVoices()
  if (live.length) cachedVoices = live
}

/** Подписаться на voiceschanged (Chrome грузит голоса асинхронно). */
export function initSpeechVoices(): void {
  if (!speechSynthesisSupported()) return
  refreshSpeechVoices()
  speechSynthesis.addEventListener("voiceschanged", refreshSpeechVoices)
}

/** Дождаться появления голосов (до timeout мс). */
export function waitForSpeechVoices(timeoutMs = 4000): Promise<SpeechVoiceLike[]> {
  if (!speechSynthesisSupported()) return Promise.resolve([])
  const existing = getSpeechVoices()
  if (existing.length) return Promise.resolve(existing)
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const tick = () => {
      refreshSpeechVoices()
      if (cachedVoices.length || Date.now() >= deadline) {
        resolve(cachedVoices.slice())
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

export function clampSpeechRate(raw: number | string | null | undefined): number {
  if (raw == null || raw === "") return 1
  return Math.min(2, Math.max(0.5, Number(raw) || 1))
}
