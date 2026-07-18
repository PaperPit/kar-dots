// IDB-кэш слайсов known terms (папки + паки) — переживает перезагрузку страницы.

export interface KnownTermsSlice {
  mini?: unknown
  n?: number
  [key: string]: unknown
}

const DB_NAME = "kar_yt_known"
const DB_VERSION = 1
const PACKS_KEY = "__packs__"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("slices")) {
        req.result.createObjectStore("slices", { keyPath: "key" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getKnownTermsSlice(key: string): Promise<KnownTermsSlice | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const req = db.transaction("slices", "readonly").objectStore("slices").get(key)
      req.onsuccess = () => resolve((req.result as { data?: KnownTermsSlice } | undefined)?.data ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function putKnownTermsSlice(key: string, data: KnownTermsSlice): Promise<void> {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const t = db.transaction("slices", "readwrite")
      t.objectStore("slices").put({ key, data })
      t.oncomplete = () => resolve(null)
      t.onerror = () => reject(t.error)
    })
  } catch {
    /* optional cache */
  }
}

async function deleteKeys(pred: (k: string) => boolean): Promise<void> {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const t = db.transaction("slices", "readwrite")
      const s = t.objectStore("slices")
      const req = s.openCursor()
      req.onsuccess = (e: Event) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          if (pred(cursor.key as string)) cursor.delete()
          cursor.continue()
        } else resolve(null)
      }
      req.onerror = () => reject(req.error)
      t.onerror = () => reject(t.error)
    })
  } catch {
    /* ignore */
  }
}

export function folderSliceKey(folderId: string, youtubeOnly: boolean): string {
  return `${folderId}:${youtubeOnly ? "yt" : "all"}`
}

export async function clearKnownTermsFolderSlices(folderId: string): Promise<void> {
  const prefix = folderId + ":"
  await deleteKeys((k) => k.startsWith(prefix))
}

export async function clearKnownTermsCardSlices(): Promise<void> {
  await deleteKeys((k) => k !== PACKS_KEY)
}

export { PACKS_KEY }
