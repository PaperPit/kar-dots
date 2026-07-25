// CloudStore — Supabase + локальное зеркало + офлайн-очередь (фасад)
import {
  openMirrorDB, mirrorPut, mirrorDelete, mirrorDeleteMany,
  mirrorSetKV, indexGetAll, SyncQueue,
} from './sync-queue.js'
import { DEFAULT_SETTINGS } from './store-common.js'
import {
  buildFolderRecord, buildCardRecord, buildBoxRecord,
} from './store-contract.js'
import {
  findFolderByPackId, importVocabPack as doImportVocabPack,
  deleteVocabPack as doDeleteVocabPack,
  type VocabImportStore,
} from './store-vocab.js'
import {
  upsertSrsMeta, removeSrsMeta, removeSrsMetaForFolder,
} from './srs-meta.js'
import { StoreCache } from './store-cache.js'
import { buildHomeStats, type HomeStats } from './home-stats.js'
import { invalidateDerivedCaches } from './cache-invalidate.js'
import type { Card, Folder, Box, Settings } from './types.js'
import type { SrsMeta } from './srs-meta.js'
import type { Algo, SrsRow } from '../lib/srs.js'
import type { ProgressInfo } from './store-vocab.js'
import type { MiniSupabase } from './supabase.js'
import { stampUpdatedAt } from './cloud-delta.js'
import { initReviewLog } from '../lib/review-log.js'
import {
  type SyncState,
  type SyncPayload,
  type CloudStoreHost,
  type CloudCompatFlags,
  emptyCompat,
  ensureCompat,
} from './cloud-store-host.js'
import {
  loadCloudFlags, executeSyncItem, removeCardImages, uploadImage as uploadImageFn,
  deleteImage as deleteImageFn,
} from './cloud-remote.js'
import {
  loadData, whenCloudReady,
} from './cloud-pull.js'
import {
  notifySync, pendingSync, deadLetterCount, deadLetters, retryDeadLetter, discardDeadLetter,
  flushSync, onOnline, cloudOrQueue, bindActivityCloudSync, bindReviewLogCloudSync,
  syncActivityNow, syncReviewLogFromCloud,
} from './cloud-sync-runtime.js'
import {
  getFolderCards as queryFolderCards,
  getReviewCards as queryReviewCards,
  getCramCards as queryCramCards,
  scanFolderFronts as queryScanFolderFronts,
  countDue as queryCountDue,
  countDueBetween as queryCountDueBetween,
  countNew as queryCountNew,
} from './cloud-queries.js'
import { exportJSONFull as exportJSONFullFn, importJSON as importJSONFn } from './cloud-import.js'

export { folderSaveErrorMessage } from '../lib/folder-errors.js'
export type { SyncState, SyncPayload }

export class CloudStore implements CloudStoreHost {
  sb: MiniSupabase
  kind: string
  folders: Folder[]
  boxes: Box[]
  settings: Settings
  _cache: StoreCache
  _srsMeta: SrsMeta[] | null
  _offline: boolean
  queue: SyncQueue
  mirror!: IDBDatabase
  _onSyncChange: ((state: SyncState) => void) | null
  _onDataChange: (() => void) | null
  _compat: CloudCompatFlags
  _homeStatsCache: HomeStats | null
  _homeStatsCacheAlgo: Algo | null
  _srsMetaPersistTimer: ReturnType<typeof setTimeout> | null
  _activityPushTimer: ReturnType<typeof setTimeout> | null
  _bgSyncTail: Promise<void>
  /** Промис текущей фоновой синхронизации с облаком (если идёт). */
  _cloudSyncPromise: Promise<void> | null

  constructor(sb: MiniSupabase) {
    this.kind = 'cloud'
    this.sb = sb
    this.folders = []
    this.boxes = []
    this.settings = Object.assign({}, DEFAULT_SETTINGS)
    this._cache = new StoreCache()
    this._srsMeta = null
    this._offline = false
    this.queue = new SyncQueue()
    this._onSyncChange = null
    this._onDataChange = null
    this._compat = emptyCompat()
    this._homeStatsCache = null
    this._homeStatsCacheAlgo = null
    this._srsMetaPersistTimer = null
    this._activityPushTimer = null
    this._bgSyncTail = Promise.resolve()
    this._cloudSyncPromise = null
  }

  /** @deprecated use `_compat.boxes` — оставлено для тестов/совместимости */
  get _boxesCloudUnsupported() { return ensureCompat(this).boxes }
  set _boxesCloudUnsupported(v: boolean) { ensureCompat(this).boxes = v }

  _invalidateHomeStats() {
    this._homeStatsCache = null
    this._homeStatsCacheAlgo = null
  }

  _schedulePersistSrsMeta() {
    if (this._srsMetaPersistTimer) clearTimeout(this._srsMetaPersistTimer)
    this._srsMetaPersistTimer = setTimeout(() => {
      this._srsMetaPersistTimer = null
      this._persistSrsMeta()
    }, 200)
  }

  async _persistSrsMeta() {
    if (!this.mirror || !this._srsMeta) return
    await mirrorSetKV(this.mirror, 'srs_meta', this._srsMeta)
  }

  async _flushSrsMetaPersist() {
    if (this._srsMetaPersistTimer) {
      clearTimeout(this._srsMetaPersistTimer)
      this._srsMetaPersistTimer = null
    }
    await this._persistSrsMeta()
  }

  async getHomeStats() {
    const algo = this.settings.algo
    if (this._homeStatsCache && this._homeStatsCacheAlgo === algo) {
      return this._homeStatsCache
    }
    this._homeStatsCache = buildHomeStats(this._srsMeta || [], algo as Algo)
    this._homeStatsCacheAlgo = algo as Algo
    return this._homeStatsCache
  }

  onSyncChange(fn: (state: SyncState) => void) { this._onSyncChange = fn }
  onDataChange(fn: () => void) { this._onDataChange = fn }
  _emitDataChange() {
    if (!this._onDataChange) return
    try { this._onDataChange() } catch (e) { console.error('onDataChange failed:', e) }
  }

  get offline() { return this._offline }

  async pendingSync() { return pendingSync(this) }
  async deadLetterCount() { return deadLetterCount(this) }
  async deadLetters() { return deadLetters(this) }
  async retryDeadLetter(id: number) { return retryDeadLetter(this, id) }
  async discardDeadLetter(id: number) { return discardDeadLetter(this, id) }
  async flushSync() { return flushSync(this) }

  async init() {
    this.mirror = await openMirrorDB()
    await this.queue.init(this.mirror)
    await loadCloudFlags(this)
    this.queue.onFlush(item => executeSyncItem(this, item as { op: string; payload: SyncPayload }))
    this.queue.onDeadLetter(() => notifySync(this))
    window.addEventListener('online', () => { void onOnline(this) })
    bindActivityCloudSync(this)
    bindReviewLogCloudSync(this)
    void initReviewLog()
    await loadData(this, flushSync, notifySync)
  }

  async syncReviewLogFromCloud(): Promise<number> {
    return syncReviewLogFromCloud(this)
  }

  getAllSrsRows(): SrsRow[] {
    return (this._srsMeta || []) as unknown as SrsRow[]
  }

  async syncActivityNow() {
    return syncActivityNow(this)
  }

  async whenCloudReady() {
    return whenCloudReady(this, flushSync, notifySync)
  }

  _patchSrsMeta(card: Card) {
    if (!this._srsMeta) this._srsMeta = []
    upsertSrsMeta(this._srsMeta, card)
    this._schedulePersistSrsMeta()
  }

  _patchSrsMetaRemoval(id: string) {
    if (!this._srsMeta) return
    this._srsMeta = removeSrsMeta(this._srsMeta, id)
    this._schedulePersistSrsMeta()
  }

  async getFolderCards(folderId: string) {
    return queryFolderCards(this, folderId)
  }

  async countCards(folderId?: string | null) {
    return this._cache.countCards(folderId ?? undefined)
  }

  async countDue(folderId: string | null, algo: Algo) {
    return queryCountDue(this, folderId, algo)
  }

  async countDueBetween(folderId: string | null, algo: Algo, from: number, to: number) {
    return queryCountDueBetween(this, folderId, algo, from, to)
  }

  async countNew(folderId: string | null, algo: Algo) {
    return queryCountNew(this, folderId, algo)
  }

  async getReviewCards(folderId: string | null, algo: Algo, newLimit: number, now: number) {
    return queryReviewCards(this, folderId, algo, newLimit, now)
  }

  async getCramCards(folderId: string | null, limit: number) {
    return queryCramCards(this, folderId, limit)
  }

  async scanFolderFronts(folderId: string | null, opts?: { youtubeOnly?: boolean }) {
    return queryScanFolderFronts(this, folderId, opts)
  }

  async _getCardById(id: string): Promise<Card | null> {
    for (const list of this._cache.folderCache.values()) {
      const c = list.find(x => x.id === id)
      if (c) return c
    }
    return new Promise((resolve, reject) => {
      const req = this.mirror.transaction('cards').objectStore('cards').get(id)
      req.onsuccess = () => resolve((req.result as Card | null) || null)
      req.onerror = () => reject(req.error)
    })
  }

  async createFolder(data: Partial<Folder>) {
    const row = buildFolderRecord(data, { user_id: this.sb.userId() })
    this.folders.push(row)
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    this._cache.setCount(row.id, 0)
    await mirrorPut(this.mirror, 'folders', row)
    return cloudOrQueue(this, 'createFolder', { row }, async () => row)
  }

  async updateFolder(id: string, patch: Partial<Folder>) {
    const f = this.folders.find(x => x.id === id)
    if (!f) return null
    const stamped = stampUpdatedAt(patch)
    Object.assign(f, stamped)
    await mirrorPut(this.mirror, 'folders', f)
    return cloudOrQueue(this, 'updateFolder', { id, patch: stamped }, async () => f)
  }

  async deleteFolder(id: string) {
    const dead = (await indexGetAll(this.mirror, 'cards', 'folder_id', id)) as Card[]
    await Promise.all(dead.map(c => removeCardImages(this, c)))
    await mirrorDeleteMany(this.mirror, 'cards', dead.map(c => c.id!))
    await mirrorDelete(this.mirror, 'folders', id)
    this.folders = this.folders.filter(f => f.id !== id)
    this._cache.deleteFolder(id)
    if (this._srsMeta) {
      this._srsMeta = removeSrsMetaForFolder(this._srsMeta, id)
      await this._flushSrsMetaPersist()
    }
    invalidateDerivedCaches(this, { folderId: id })
    return cloudOrQueue(this, 'deleteFolder', { id }, async () => true)
  }

  async createBox(data: Partial<Box>) {
    const row = buildBoxRecord(data, { user_id: this.sb.userId() })
    this.boxes.push(row)
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    await mirrorPut(this.mirror, 'boxes', row)
    if (this._compat.boxes) return row
    return cloudOrQueue(this, 'createBox', { row }, async () => row)
  }

  async updateBox(id: string, patch: Partial<Box>) {
    const b = this.boxes.find(x => x.id === id)
    if (!b) return null
    const stamped = stampUpdatedAt(patch)
    Object.assign(b, stamped)
    await mirrorPut(this.mirror, 'boxes', b)
    if (this._compat.boxes) return b
    return cloudOrQueue(this, 'updateBox', { id, patch: stamped }, async () => b)
  }

  async deleteBox(id: string) {
    for (const f of this.folders.filter(x => x.box_id === id)) {
      f.box_id = undefined
      await mirrorPut(this.mirror, 'folders', f)
    }
    await mirrorDelete(this.mirror, 'boxes', id)
    this.boxes = this.boxes.filter(b => b.id !== id)
    if (this._compat.boxes) return true
    return cloudOrQueue(this, 'deleteBox', { id }, async () => true)
  }

  async assignFolderToBox(folderId: string, boxId?: string | null) {
    const f = this.folders.find(x => x.id === folderId)
    if (!f) return null
    if (boxId && !this.boxes.find(b => b.id === boxId)) return null
    const stamped = stampUpdatedAt({ box_id: boxId || null })
    Object.assign(f, stamped)
    await mirrorPut(this.mirror, 'folders', f)
    return cloudOrQueue(this, 'updateFolder', { id: folderId, patch: stamped }, async () => f)
  }

  async setBoxFolders(boxId: string, folderIds: string[]) {
    const idSet = new Set(folderIds)
    for (const f of this.folders) {
      if (f.box_id === boxId && !idSet.has(f.id)) {
        const stamped = stampUpdatedAt({ box_id: null })
        Object.assign(f, stamped)
        await mirrorPut(this.mirror, 'folders', f)
        await cloudOrQueue(this, 'updateFolder', { id: f.id, patch: stamped }, async () => f)
      }
    }
    for (const fid of folderIds) {
      const f = this.folders.find(x => x.id === fid)
      if (!f || (f.box_id && f.box_id !== boxId)) continue
      const stamped = stampUpdatedAt({ box_id: boxId })
      Object.assign(f, stamped)
      await mirrorPut(this.mirror, 'folders', f)
      await cloudOrQueue(this, 'updateFolder', { id: fid, patch: stamped }, async () => f)
    }
  }

  findFolderByPackId(packId: string) {
    return findFolderByPackId(this.folders, packId)
  }

  async importVocabPack(pack: any, onProgress?: (n: number) => void) {
    return doImportVocabPack(this as unknown as VocabImportStore, pack, onProgress as ((info: ProgressInfo) => void) | undefined)
  }

  async deleteVocabPack(packId: string) {
    return doDeleteVocabPack(this as unknown as VocabImportStore, packId)
  }

  async createCard(data: Partial<Card>) {
    const row = buildCardRecord(data, { user_id: this.sb.userId() })
    await mirrorPut(this.mirror, 'cards', row)
    this._patchSrsMeta(row)
    this._cache.prependCard(row.folder_id ?? "", row)
    this._cache.bumpCount(row.folder_id ?? "", 1)
    invalidateDerivedCaches(this, { folderId: row.folder_id })
    return cloudOrQueue(this, 'createCard', { row }, async () => row)
  }

  async updateCard(id: string, patch: Partial<Card>) {
    let c = await this._getCardById(id)
    if (!c) return null
    const stamped = stampUpdatedAt(patch)
    Object.assign(c, stamped as Partial<Card>)
    await mirrorPut(this.mirror, 'cards', c)
    this._patchSrsMeta(c)
    this._cache.patchCardInLists(id, stamped as Partial<Card>)
    invalidateDerivedCaches(this, { folderId: c.folder_id })
    return cloudOrQueue(this, 'updateCard', { id, patch: stamped }, async () => c, { optimistic: true })
  }

  async deleteCard(id: string) {
    const c = await this._getCardById(id)
    const urls = c ? [c.front_img, c.back_img].filter(Boolean) : []
    if (c) {
      await removeCardImages(this, c)
      await mirrorDelete(this.mirror, 'cards', id)
      this._patchSrsMetaRemoval(id)
      this._cache.removeCard(c.folder_id!, id)
      this._cache.bumpCount(c.folder_id!, -1)
      await this._flushSrsMetaPersist()
    }
    invalidateDerivedCaches(this, { folderId: c?.folder_id })
    return cloudOrQueue(this, 'deleteCard', { id, urls }, async () => true)
  }

  async uploadImage(file: Blob) {
    return uploadImageFn(this, file)
  }

  async deleteImage(url: string) {
    return deleteImageFn(this, url)
  }

  async saveSettings(s: Settings) {
    this.settings = s
    await mirrorSetKV(this.mirror, 'settings', s)
    if (s.algo === 'fsrs') {
      const { preloadFsrs } = await import('../lib/srs.js')
      await preloadFsrs()
    }
    return cloudOrQueue(this, 'saveSettings', { settings: s }, async () => s)
  }

  async exportJSONFull() {
    return exportJSONFullFn(this)
  }

  async importJSON(text: string) {
    return importJSONFn(this, text)
  }
}
