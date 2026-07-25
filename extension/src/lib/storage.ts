import {
  DEFAULT_PREFS,
  STORAGE_KEYS,
  type ExtAuth,
  type ExtPrefs,
  type ExtVideo
} from "./constants.js"

export async function getAuth(): Promise<ExtAuth | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.auth)
  return (data[STORAGE_KEYS.auth] as ExtAuth | undefined) || null
}

export async function setAuth(auth: ExtAuth | null): Promise<void> {
  if (auth) await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth })
  else await chrome.storage.local.remove(STORAGE_KEYS.auth)
}

export async function getPrefs(): Promise<ExtPrefs> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.prefs)
  return { ...DEFAULT_PREFS, ...(data[STORAGE_KEYS.prefs] as Partial<ExtPrefs> | undefined) }
}

export async function setPrefs(patch: Partial<ExtPrefs>): Promise<ExtPrefs> {
  const next = { ...(await getPrefs()), ...patch }
  await chrome.storage.local.set({ [STORAGE_KEYS.prefs]: next })
  return next
}

/** Видео держим в local — session в Side Panel иногда недоступен/падает. */
export async function getVideo(): Promise<ExtVideo | null> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.video)
    return (data[STORAGE_KEYS.video] as ExtVideo | undefined) || null
  } catch {
    return null
  }
}

export async function setVideo(video: ExtVideo | null): Promise<void> {
  try {
    if (video) await chrome.storage.local.set({ [STORAGE_KEYS.video]: video })
    else await chrome.storage.local.remove(STORAGE_KEYS.video)
  } catch {
    /* ignore */
  }
}
