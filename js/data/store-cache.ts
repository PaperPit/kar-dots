/** Shared in-memory folder card list cache and per-folder card counts. */

export class StoreCache {
  constructor() {
    this.folderCache = new Map();
    this.cardCounts = new Map();
  }

  clearFolderLists() {
    this.folderCache.clear();
  }

  clearAll() {
    this.folderCache.clear();
    this.cardCounts.clear();
  }

  deleteFolder(folderId) {
    this.folderCache.delete(folderId);
    this.cardCounts.delete(folderId);
  }

  setCount(folderId, n) {
    this.cardCounts.set(folderId, n);
  }

  bumpCount(folderId, delta) {
    this.cardCounts.set(folderId, Math.max(0, (this.cardCounts.get(folderId) || 0) + delta));
  }

  countCards(folderId) {
    if (folderId) return this.cardCounts.get(folderId) ?? 0;
    let n = 0;
    for (const c of this.cardCounts.values()) n += c;
    return n;
  }

  hasCount(folderId) {
    return this.cardCounts.has(folderId);
  }

  getCount(folderId) {
    return this.cardCounts.get(folderId);
  }

  rebuildCountsFromSrsMeta(folders, srsMeta) {
    this.cardCounts.clear();
    for (const f of folders) {
      this.cardCounts.set(f.id, srsMeta.filter(c => c.folder_id === f.id).length);
    }
  }

  prependCard(folderId, card) {
    const cached = this.folderCache.get(folderId);
    if (cached) cached.unshift(card);
  }

  removeCard(folderId, cardId) {
    const list = this.folderCache.get(folderId);
    if (!list) return;
    const idx = list.findIndex(x => x.id === cardId);
    if (idx >= 0) list.splice(idx, 1);
  }

  patchCardInLists(cardId, patch) {
    for (const list of this.folderCache.values()) {
      const idx = list.findIndex(x => x.id === cardId);
      if (idx >= 0) Object.assign(list[idx], patch);
    }
  }
}
