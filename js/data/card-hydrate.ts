/** Batch IDB/cache lookup for review queue hydration. */

import type { Card } from "./types.js"
import type { SrsRow } from "../lib/srs.js"
import type { StoreCache } from "./store-cache.js"

export async function getCardsByIds(
  db: IDBDatabase | null,
  cache: StoreCache,
  ids: (string | undefined)[]
): Promise<Map<string, Card>> {
  const map = new Map<string, Card>()
  if (!ids.length) return map
  const want = new Set(ids)
  for (const list of cache.folderCache.values()) {
    for (const c of list) {
      if (c.id && want.has(c.id)) map.set(c.id, c)
    }
  }
  const missing = ids.filter((id): id is string => !!id && !map.has(id))
  if (!missing.length) return map
  await new Promise<void>((resolve, reject) => {
    const t = db!.transaction("cards", "readonly")
    const s = t.objectStore("cards")
    let pending = missing.length
    for (const id of missing) {
      const req = s.get(id)
      req.onsuccess = () => {
        if (req.result) map.set(id, req.result as Card)
        if (--pending === 0) resolve()
      }
      req.onerror = () => reject(req.error)
    }
    t.onerror = () => reject(t.error)
  })
  return map
}

export function hydrateReviewQueue(
  queueRows: SrsRow[],
  byId: Map<string, Card>
): Card[] {
  return queueRows
    .map((c) => (c.id ? byId.get(c.id) : undefined))
    .filter((c): c is Card => Boolean(c))
}
