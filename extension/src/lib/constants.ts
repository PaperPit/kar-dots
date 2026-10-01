/**
 * Origin веб-приложения. По умолчанию официальный демо-хост.
 * Self-host: KAR_EXT_APP_ORIGIN=https://your.domain npm run ext:build
 */
declare const KAR_EXT_APP_ORIGIN: string | undefined
export const APP_ORIGIN = KAR_EXT_APP_ORIGIN ?? "https://kar-tochki.pages.dev"

export const CONNECT_URL = `${APP_ORIGIN}/#settings`

export const STORAGE_KEYS = {
  prefs: "kar_ext_prefs",
  video: "kar_ext_video"
} as const

export type ImportMode = "words" | "phrases" | "both" | "sentences"

export const MODES: { id: ImportMode; label: string }[] = [
  { id: "words", label: "Слова" },
  { id: "phrases", label: "Фразы" },
  { id: "both", label: "Слова + фразы" },
  { id: "sentences", label: "Предложения" }
]

export interface ExtPrefs {
  mode: ImportMode
  mergeCues: boolean
  folderName: string
  supadataApiKey: string
  geminiApiKey: string
  groqApiKey: string
}

export interface ExtVideo {
  url: string
  title?: string
  tabId?: number
}

export type ExtMessage =
  | { type: "SET_VIDEO"; url: string; title?: string; tabId?: number }
  | { type: "GET_STATE" }
  | { type: "PING_CONNECT" }

export const DEFAULT_PREFS: ExtPrefs = {
  mode: "both",
  mergeCues: true,
  folderName: "YouTube",
  supadataApiKey: "",
  geminiApiKey: "",
  groqApiKey: ""
}
