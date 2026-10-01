import type { Settings } from "../../../js/data/types.js"

export interface ExtFolder {
  id: string
  name: string
}

/** Локальная «папка» для экспорта JSON (без cloud). */
export function defaultExportFolder(name = "YouTube"): ExtFolder {
  return { id: "export", name: name || "YouTube" }
}

/** Ключи API хранятся в prefs расширения, не в Supabase settings. */
export function settingsFromPrefs(prefs: {
  supadataApiKey?: string
  geminiApiKey?: string
  groqApiKey?: string
}): Settings {
  return {
    supadataApiKey: prefs.supadataApiKey || "",
    geminiApiKey: prefs.geminiApiKey || "",
    groqApiKey: prefs.groqApiKey || ""
  } as Settings
}
