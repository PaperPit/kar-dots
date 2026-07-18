// IDB-кэш слайсов known terms (папки + паки) — переживает перезагрузку страницы.

const DB_NAME = 'kar_yt_known';
const DB_VERSION = 1;
const PACKS_KEY = '__packs__';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('slices')) {
        req.result.createObjectStore('slices', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getKnownTermsSlice(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction('slices', 'readonly').objectStore('slices').get(key);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function putKnownTermsSlice(key, data) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const t = db.transaction('slices', 'readwrite');
      t.objectStore('slices').put({ key, data });
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } catch { /* optional cache */ }
}

async function deleteKeys(pred) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const t = db.transaction('slices', 'readwrite');
      const s = t.objectStore('slices');
      const req = s.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (pred(cursor.key)) cursor.delete();
          cursor.continue();
        } else resolve();
      };
      req.onerror = () => reject(req.error);
      t.onerror = () => reject(t.error);
    });
  } catch { /* ignore */ }
}

export function folderSliceKey(folderId, youtubeOnly) {
  return `${folderId}:${youtubeOnly ? 'yt' : 'all'}`;
}

export async function clearKnownTermsFolderSlices(folderId) {
  const prefix = folderId + ':';
  await deleteKeys(k => k.startsWith(prefix));
}

export async function clearKnownTermsCardSlices() {
  await deleteKeys(k => k !== PACKS_KEY);
}

export { PACKS_KEY };
