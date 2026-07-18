import { store } from "../core/state.js"
import { stripHtml, toast } from "./ui.js"
import { Card } from "./types.js"
import {
  detectSpeechLang,
  resolveSpeechVoice,
  waitForSpeechVoices,
  getSpeechVoices,
  clampSpeechRate,
  speechSynthesisSupported
} from "../lib/web-speech-tts.js"

export { detectSpeechLang } from "../lib/web-speech-tts.js"

interface TtsSettings {
  ttsVoiceEn?: string
  ttsVoiceRu?: string
  ttsRate?: number
  [key: string]: unknown
}

let speakSession = 0

export function stopAllSpeech(): void {
  speakSession += 1
  if (speechSynthesisSupported()) speechSynthesis.cancel()
}

function voiceUriForLang(settings: TtsSettings | undefined, lang?: string): string {
  const en = String(lang || "")
    .toLowerCase()
    .startsWith("en")
  return en ? settings?.ttsVoiceEn || "" : settings?.ttsVoiceRu || ""
}

function speechRate(settings: TtsSettings | undefined): number {
  return clampSpeechRate(settings?.ttsRate)
}

function speakUtteranceAsync(
  text: string,
  lang?: string,
  settings?: TtsSettings,
  session?: number
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (session !== speakSession || !speechSynthesisSupported()) {
      resolve(undefined)
      return
    }
    const resolved = lang || detectSpeechLang(text)
    const voices = getSpeechVoices()
    const voice = resolveSpeechVoice(voices, resolved, voiceUriForLang(settings, resolved))
    const u = new SpeechSynthesisUtterance(text)
    u.lang = resolved
    u.rate = speechRate(settings)
    if (voice) u.voice = voice as SpeechSynthesisVoice
    const done = () => {
      if (session === speakSession) resolve()
    }
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
  })
}

async function speakOne(text: string, lang?: string, settings?: TtsSettings) {
  const trimmed = String(text || "").trim()
  if (!trimmed) return
  if (!speechSynthesisSupported()) {
    toast("Озвучка недоступна в этом браузере", "error")
    return
  }
  stopAllSpeech()
  const session = speakSession
  await waitForSpeechVoices()
  if (session !== speakSession) return
  await speakUtteranceAsync(trimmed, lang, settings, session)
}

/**
 * @param {string} text
 * @param {string} [lang]
 */
export async function speakText(text?: string, lang?: string) {
  if (!text?.trim()) return
  const settings: TtsSettings = store?.settings || {}
  await speakOne(text, lang, settings)
}

export async function speakSequence(texts: string | string[]) {
  const queue = (Array.isArray(texts) ? texts : [texts])
    .map((t) => String(t || "").trim())
    .filter(Boolean)
  for (const t of queue) {
    await speakText(t)
  }
}

export async function speakCardSide(card: Card, side: "front" | "back") {
  const parts = []
  if (side === "front") {
    const t = stripHtml(card.front)
    if (t) parts.push(t)
  } else {
    const b = stripHtml(card.back)
    if (b) parts.push(b)
    const d = stripHtml(card.description || "")
    if (d) parts.push(d)
  }
  if (!parts.length) return false
  await speakSequence(parts)
  return true
}

/** Прослушать выбранный системный голос в настройках. */
export async function previewSpeechVoice(lang?: string) {
  const sample = String(lang || "")
    .toLowerCase()
    .startsWith("en")
    ? "Hello"
    : "Привет"
  await speakText(sample, lang)
}
