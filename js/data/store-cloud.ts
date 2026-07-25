// CloudStore — Supabase + локальное зеркало + офлайн-очередь (фасад)
import { isNetworkError } from './supabase.js'
import {
  openMirrorDB, getAll, mirrorPut, mirrorPutMany, mirrorDelete, mirrorDeleteMany,
  mirrorSetKV, indexGetAll, SyncQueue,
} from './sync-queue.js'
import { DEFAULT_SETTINGS } from './store-common.js'
import { normalizeFolderRecord, normalizeBoxRecord } from '../lib/folder-icons.js'
import {
  buildFolderRecord, buildCardRecord, buildBoxRecord, exportJSONPayload,
} from './store-contract.js'
import {
  countDueForFolder, countDueBetweenForFolder, countNewForFolder, buildReviewQueue, filterByFolder,
} from './srs-query.js'
import {
  findFolderByPackId, importVocabPack as doImportVocabPack,
  deleteVocabPack as doDeleteVocabPack,
  type VocabImportStore,
} from './store-vocab.js'
import { shuffle } from '../lib/shuffle.js'
import {
  REVIEW_CARD_FIELDS, upsertSrsMeta, removeSrsMeta, removeSrsMetaForFolder,
} from './srs-meta.js'
import { StoreCache } from './store-cache.js'
import { buildHomeStats, type HomeStats } from './home-stats.js'
import { invalidateDerivedCaches } from './cache-invalidate.js'
import { getCardsByIds, hydrateReviewQueue } from './card-hydrate.js'
import { isYoutubeCard } from '../lib/youtube-import.js'
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
  _folderIconCloudUnsupported: boolean
  _reviewLogCloudUnsupported: boolean
  _boxesCloudUnsupported: boolean
  _boxIdCloudUnsupported: boolean
  _boxIconCloudUnsupported: boolean
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
    this._folderIconCloudUnsupported = false
    this._reviewLogCloudUnsupported = false
    this._boxesCloudUnsupported = false
    this._boxIdCloudUnsupported = false
    this._boxIconCloudUnsupported = false
    this._homeStatsCache = null
    this._homeStatsCacheAlgo = null
    this._srsMetaPersistTimer = null
    this._activityPushTimer = null
    this._bgSyncTail = Promise.resolve()
    this._cloudSyncPromise = null
  }

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
  /** Колбэк перерисовки текущего экрана после фоновой догрузки данных из облака. */
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

  /** Подтянуть журнал повторений из облака (вызывать на экране статистики). */
  async syncReviewLogFromCloud(): Promise<number> {
    return syncReviewLogFromCloud(this)
  }

  /** Все slim-SRS строки карточек — для прогноза нагрузки на экране статистики. */
  getAllSrsRows(): SrsRow[] {
    return (this._srsMeta || []) as unknown as SrsRow[]
  }

  /** Явно слить/отправить статистику дня (Знаю/Не знаю/серия). */
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
    if (this._cache.folderCache.has(folderId)) return this._cache.folderCache.get(folderId)
    let cards
    if (navigator.onLine && !this._offline) {
      try {
        cards = await this.sb.select<Card>('cards', 'folder_id=eq.' + folderId + '&order=created_at.desc')
        await mirrorPutMany(this.mirror, 'cards', cards)
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true
          cards = await indexGetAll<Card>(this.mirror, 'cards', 'folder_id', folderId ?? '')
        } else throw e
      }
    } else {
      cards = await indexGetAll<Card>(this.mirror, 'cards', 'folder_id', folderId)
    }
    cards.sort((a: Card, b: Card) => (b.created_at || 0) - (a.created_at || 0))
    this._cache.folderCache.set(folderId, cards)
    return cards
  }

  async countCards(folderId?: string | null) {
    return this._cache.countCards(folderId ?? undefined)
  }

  async countDue(folderId: string | null, algo: Algo) {
    algo = algo || this.settings.algo
    return countDueForFolder(this._srsMeta ?? [], folderId, algo, Date.now())
  }

  async countDueBetween(folderId: string | null, algo: Algo, from: number, to: number) {
    algo = algo || this.settings.algo
    return countDueBetweenForFolder(this._srsMeta ?? [], folderId, algo, from, to)
  }

  async countNew(folderId: string | null, algo: Algo) {
    algo = algo || this.settings.algo
    return countNewForFolder(this._srsMeta ?? [], folderId, algo)
  }

  async getReviewCards(folderId: string | null, algo: Algo, newLimit: number, now: number) {
    algo = algo || this.settings.algo
    now = now || Date.now()
    if (navigator.onLine && !this._offline) {
      try {
        const uid = this.sb.userId()
        const prefix = folderId ? 'folder_id=eq.' + folderId + '&user_id=eq.' + uid : 'user_id=eq.' + uid
        const sel = '&select=' + REVIEW_CARD_FIELDS
        const dueQ = algo === 'leitner'
          ? prefix + '&box=gt.0&box_due=lte.' + now + sel
          : algo === 'fsrs'
            ? prefix + '&fsrs_due=not.is.null&fsrs_due=lte.' + now + sel
            : prefix + '&sm2_due=not.is.null&sm2_due=lte.' + now + sel
        const newQ = algo === 'leitner'
          ? prefix + '&box=eq.0' + sel + '&limit=' + newLimit
          : algo === 'fsrs'
            ? prefix + '&fsrs_reps=is.null&fsrs_due=is.null' + sel + '&limit=' + newLimit
            : prefix + '&sm2_reps=eq.0&sm2_due=is.null' + sel + '&limit=' + newLimit
        const [dueCards, newCards] = await Promise.all([
          this.sb.select('cards', dueQ),
          this.sb.select('cards', newQ),
        ])
        await mirrorPutMany(this.mirror, 'cards', dueCards.concat(newCards))
        return { due: shuffle(dueCards), fresh: shuffle(newCards).slice(0, newLimit) }
      } catch (e) { if (!isNetworkError(e)) throw e; this._offline = true }
    }

    const source = filterByFolder(this._srsMeta || [], folderId)
    const { due, fresh } = buildReviewQueue(source, algo, newLimit, now)
    const ids = [...due.map(c => c.id), ...fresh.map(c => c.id)]
    const byId = await getCardsByIds(this.mirror, this._cache, ids)
    return {
      due: hydrateReviewQueue(due, byId),
      fresh: hydrateReviewQueue(fresh, byId),
    }
  }

  async getCramCards(folderId: string | null, limit: number) {
    const source = filterByFolder(this._srsMeta || [], folderId)
    const picked = shuffle(source)
    const slice = limit > 0 ? picked.slice(0, limit) : picked
    const byId = await getCardsByIds(this.mirror, this._cache, slice.map(c => c.id))
    return hydrateReviewQueue(slice, byId)
  }

  async scanFolderFronts(folderId: string | null, { youtubeOnly = false }: { youtubeOnly?: boolean } = {}) {
    if (navigator.onLine && !this._offline) {
      try {
        const rows = (await this.sb.select('cards', 'folder_id=eq.' + folderId + '&select=front,description')) as Card[]
        return rows
          .filter(c => !youtubeOnly || isYoutubeCard(c))
          .filter(c => c.front)
          .map(c => ({ front: c.front }))
      } catch (e) {
        if (!isNetworkError(e)) throw e
        this._offline = true
      }
    }
    const cards = (await indexGetAll(this.mirror, 'cards', 'folder_id', folderId ?? '')) as Card[]
    const mini = []
    for (const c of cards) {
      if (youtubeOnly && !isYoutubeCard(c)) continue
      if (c.front) mini.push({ front: c.front })
    }
    return mini
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
    if (this._boxesCloudUnsupported) return row
    return cloudOrQueue(this, 'createBox', { row }, async () => row)
  }

  async updateBox(id: string, patch: Partial<Box>) {
    const b = this.boxes.find(x => x.id === id)
    if (!b) return null
    const stamped = stampUpdatedAt(patch)
    Object.assign(b, stamped)
    await mirrorPut(this.mirror, 'boxes', b)
    if (this._boxesCloudUnsupported) return b
    return cloudOrQueue(this, 'updateBox', { id, patch: stamped }, async () => b)
  }

  async deleteBox(id: string) {
    for (const f of this.folders.filter(x => x.box_id === id)) {
      f.box_id = undefined
      await mirrorPut(this.mirror, 'folders', f)
    }
    await mirrorDelete(this.mirror, 'boxes', id)
    this.boxes = this.boxes.filter(b => b.id !== id)
    if (this._boxesCloudUnsupported) return true
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
    const cards = await getAll(this.mirror, 'cards')
    return exportJSONPayload(this.folders, cards, this.settings, this.boxes)
  }

  async importJSON(text: string) {
    const data = JSON.parse(text)
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла')
    for (const b of (data.boxes || [])) {
      if (this.boxes.find(x => x.id === b.id)) continue
      const row = normalizeBoxRecord(Object.assign({}, b, { user_id: this.sb.userId() }))
      if (row) {
        this.boxes.push(row)
        await mirrorPut(this.mirror, 'boxes', row)
        await cloudOrQueue(this, 'createBox', { row }, async () => row)
      }
    }
    for (const f of data.folders) {
      if (this.folders.find(x => x.id === f.id)) continue
      const row = normalizeFolderRecord(Object.assign({}, f, { user_id: this.sb.userId() }))
      if (row) {
        this.folders.push(row)
        await mirrorPut(this.mirror, 'folders', row)
        await cloudOrQueue(this, 'createFolder', { row }, async () => row)
      }
    }
    const importRows = []
    for (const c of data.cards) {
      if (c.description == null) c.description = ''
      const row = Object.assign({}, c, { user_id: this.sb.userId() })
      for (const side of ['front_img', 'back_img']) {
        if (row[side] && row[side].startsWith('data:')) {
          try {
            const blob = await (await fetch(row[side])).blob()
            const ext = blob.type === 'image/png' ? 'png' : 'jpg'
            row[side] = await this.uploadImage(new File([blob], 'img.' + ext, { type: blob.type }))
          } catch (e) { row[side] = null }
        }
      }
      importRows.push(row)
    }
    const BATCH = 100
    for (let i = 0; i < importRows.length; i += BATCH) {
      await mirrorPutMany(this.mirror, 'cards', importRows.slice(i, i + BATCH))
    }
    for (const row of importRows) {
      this._patchSrsMeta(row)
      await cloudOrQueue(this, 'createCard', { row }, async () => row)
    }
    if (data.settings) await this.saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings))
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    this._cache.clearFolderLists()
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta || [])
    await this._flushSrsMetaPersist()
    invalidateDerivedCaches(this, { allFolders: true })
  }
}
