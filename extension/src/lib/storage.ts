import {
  DEFAULT_PREFS,
  STORAGE_KEYS,
  type ExtAuth,
  type ExtPrefs,
  type ExtVideo
} from "./constants.js"

function storageAlive(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id && !!chrome.storage?.local
  } catch {
    return false
  }
}

export async function getAuth(): Promise<ExtAuth | null> {
  if (!storageAlive()) return null
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.auth)
    return (data[STORAGE_KEYS.auth] as ExtAuth | undefined) || null
  } catch {
    return null
  }
}

export async function setAuth(auth: ExtAuth | null): Promise<void> {
  if (!storageAlive()) return
  try {
    if (auth) await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth })
    else await chrome.storage.local.remove(STORAGE_KEYS.auth)
  } catch {
    /* ignore */
  }
}

export async function getPrefs(): Promise<ExtPrefs> {
  if (!storageAlive()) return { ...DEFAULT_PREFS }
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.prefs)
    return { ...DEFAULT_PREFS, ...(data[STORAGE_KEYS.prefs] as Partial<ExtPrefs> | undefined) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export async function setPrefs(patch: Partial<ExtPrefs>): Promise<ExtPrefs> {
  const next = { ...(await getPrefs()), ...patch }
  if (!storageAlive()) return next
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.prefs]: next })
  } catch {
    /* ignore */
  }
  return next
}

/** Видео держим в local — session в Side Panel иногда недоступен/падает. */
export async function getVideo(): Promise<ExtVideo | null> {
  if (!storageAlive()) return null
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.video)
    return (data[STORAGE_KEYS.video] as ExtVideo | undefined) || null
  } catch {
    return null
  }
}

export async function setVideo(video: ExtVideo | null): Promise<void> {
  if (!storageAlive()) return
  try {
    if (video) await chrome.storage.local.set({ [STORAGE_KEYS.video]: video })
    else await chrome.storage.local.remove(STORAGE_KEYS.video)
  } catch {
    /* ignore — часто Extension context invalidated после Reload */
  }
}
