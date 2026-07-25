/** Прод-инстанс КАР-точки — единственный origin расширения. */
export const APP_ORIGIN = "https://kar-tochki.pages.dev"

export const CONNECT_URL = `${APP_ORIGIN}/?ext_connect=1`

export const STORAGE_KEYS = {
  auth: "kar_ext_auth",
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

export interface ExtAuth {
  session: {
    access_token?: string
    refresh_token?: string
    expires_at_ms?: number
    user?: { id?: string; email?: string; [k: string]: unknown }
    [k: string]: unknown
  }
  supabaseUrl: string
  anonKey: string
  connectedAt: number
}

export interface ExtPrefs {
  mode: ImportMode
  mergeCues: boolean
  folderId: string | null
}

export interface ExtVideo {
  url: string
  title?: string
  tabId?: number
}

export type ExtMessage =
  | { type: "OPEN_PANEL"; url?: string; title?: string }
  /** @deprecated alias — старые content scripts */
  | { type: "OPEN_SIDEPANEL"; url?: string; title?: string }
  | { type: "OPEN_TAB"; url: string }
  | { type: "SET_VIDEO"; url: string; title?: string; tabId?: number }
  | { type: "AUTH_CONNECT"; session: ExtAuth["session"]; supabaseUrl: string; anonKey: string }
  | { type: "AUTH_DISCONNECT" }
  | { type: "GET_STATE" }
  | { type: "PING_CONNECT" }

export const DEFAULT_PREFS: ExtPrefs = {
  mode: "both",
  mergeCues: true,
  folderId: null
}
