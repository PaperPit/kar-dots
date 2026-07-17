/** Batch IDB/cache lookup for review queue hydration. */

export async function getCardsByIds(db, cache, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const want = new Set(ids);
  for (const list of cache.folderCache.values()) {
    for (const c of list) {
      if (want.has(c.id)) map.set(c.id, c);
    }
  }
  const missing = ids.filter(id => !map.has(id));
  if (!missing.length) return map;
  await new Promise((resolve, reject) => {
    const t = db.transaction('cards', 'readonly');
    const s = t.objectStore('cards');
    let pending = missing.length;
    for (const id of missing) {
      const req = s.get(id);
      req.onsuccess = () => {
        if (req.result) map.set(id, req.result);
        if (--pending === 0) resolve();
      };
      req.onerror = () => reject(req.error);
    }
    t.onerror = () => reject(t.error);
  });
  return map;
}

export function hydrateReviewQueue(queueRows, byId) {
  return queueRows.map(c => byId.get(c.id)).filter(Boolean);
}
