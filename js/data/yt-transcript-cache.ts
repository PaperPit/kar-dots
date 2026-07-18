/** Кэш транскриптов YouTube в IndexedDB — videoId → { video, transcript, fetchedAt }. TTL 7 дней. */

const DB_NAME = 'kartochki-yt-transcript';
const STORE = 'transcripts';
const DB_VERSION = 1;

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isTranscriptCacheFresh(fetchedAt, ttlMs = CACHE_TTL_MS) {
  const t = Number(fetchedAt);
  return t > 0 && Date.now() - t < ttlMs;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;

function getDB() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) dbPromise = openDB().catch(() => null);
  return dbPromise;
}

export async function getCachedTranscript(videoId) {
  const id = String(videoId || '').trim();
  if (!id) return null;
  const db = await getDB();
  if (!db) return null;
  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!row?.transcript?.segments?.length) return null;
  if (!isTranscriptCacheFresh(row.fetchedAt)) return null;
  return row;
}

export async function setCachedTranscript(videoId, { video, transcript }) {
  const id = String(videoId || '').trim();
  if (!id || !transcript?.segments?.length) return;
  const db = await getDB();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      videoId: id,
      video: video || null,
      transcript,
      fetchedAt: Date.now(),
    }, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
