/** Shared in-memory folder card list cache and per-folder card counts. */

import type { Card } from "./types.js"
import type { SrsMeta } from "./srs-meta.js"

export class StoreCache {
  folderCache: Map<string, Card[]>
  cardCounts: Map<string, number>

  constructor() {
    this.folderCache = new Map()
    this.cardCounts = new Map()
  }

  clearFolderLists() {
    this.folderCache.clear()
  }

  clearAll() {
    this.folderCache.clear()
    this.cardCounts.clear()
  }

  deleteFolder(folderId: string) {
    this.folderCache.delete(folderId)
    this.cardCounts.delete(folderId)
  }

  setCount(folderId: string, n: number) {
    this.cardCounts.set(folderId, n)
  }

  bumpCount(folderId: string, delta: number) {
    this.cardCounts.set(folderId, Math.max(0, (this.cardCounts.get(folderId) || 0) + delta))
  }

  countCards(folderId?: string) {
    if (folderId) return this.cardCounts.get(folderId) ?? 0
    let n = 0
    for (const c of this.cardCounts.values()) n += c
    return n
  }

  hasCount(folderId: string) {
    return this.cardCounts.has(folderId)
  }

  getCount(folderId: string) {
    return this.cardCounts.get(folderId)
  }

  rebuildCountsFromSrsMeta(folders: { id: string }[], srsMeta: SrsMeta[]) {
    this.cardCounts.clear()
    for (const f of folders) {
      this.cardCounts.set(f.id, srsMeta.filter((c) => c.folder_id === f.id).length)
    }
  }

  prependCard(folderId: string, card: Card) {
    const cached = this.folderCache.get(folderId)
    if (cached) cached.unshift(card)
  }

  removeCard(folderId: string, cardId: string) {
    const list = this.folderCache.get(folderId)
    if (!list) return
    const idx = list.findIndex((x) => x.id === cardId)
    if (idx >= 0) list.splice(idx, 1)
  }

  patchCardInLists(cardId: string, patch: Partial<Card>) {
    for (const list of this.folderCache.values()) {
      const idx = list.findIndex((x) => x.id === cardId)
      const card = idx >= 0 ? list[idx] : undefined
      if (card) Object.assign(card, patch)
    }
  }
}
