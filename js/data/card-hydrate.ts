/** Batch IDB/cache lookup for review queue hydration. */

import type { Card } from "./types.js"
import type { SrsRow } from "../lib/srs.js"
import type { StoreCache } from "./store-cache.js"

export interface GetCardsByIdsOptions {
  /**
   * Догрузка карточек, которых нет ни в кэше, ни в зеркале.
   * Вызывается только для реально недостающих id и только если её передали;
   * ошибки внутри — забота вызывающего (мы просто оставим карточки пропущенными).
   */
  fetchMissing?: (ids: string[]) => Promise<Card[]>
}

export async function getCardsByIds(
  db: IDBDatabase | null,
  cache: StoreCache,
  ids: (string | undefined)[],
  opts: GetCardsByIdsOptions = {}
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

  // Зеркало неполное (частичный первый синк, очистка хранилища браузером,
  // карточка приехала в SRS-дельте раньше самой карточки) — тянем недостающее
  // из сети, иначе очередь повторения молча теряет карточки.
  const stillMissing = missing.filter((id) => !map.has(id))
  if (stillMissing.length && opts.fetchMissing) {
    const fetched = await opts.fetchMissing(stillMissing)
    for (const card of fetched || []) {
      if (card && card.id) map.set(card.id, card)
    }
  }
  return map
}

/**
 * Сборка очереди повторения + список id, для которых карточку так и не нашли.
 * Пропуски не глотаем: вызывающий должен уметь показать/залогировать потерю.
 */
export function hydrateWithMisses(
  queueRows: SrsRow[],
  byId: Map<string, Card>
): { cards: Card[]; missing: string[] } {
  const cards: Card[] = []
  const missing: string[] = []
  for (const row of queueRows) {
    const card = row.id ? byId.get(row.id) : undefined
    if (card) cards.push(card)
    else if (row.id) missing.push(row.id)
  }
  if (missing.length) {
    console.warn(
      "[sync] в очередь повторения не попали карточки (нет ни в кэше, ни в зеркале, ни в облаке):",
      missing.length,
      missing.slice(0, 10)
    )
  }
  return { cards, missing }
}

export function hydrateReviewQueue(queueRows: SrsRow[], byId: Map<string, Card>): Card[] {
  return hydrateWithMisses(queueRows, byId).cards
}
