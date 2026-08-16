// CloudStore — Supabase + локальное зеркало + офлайн-очередь
import { isNetworkError } from "./supabase.js"
import {
  openMirrorDB,
  getAll,
  mirrorReplaceAll,
  mirrorPut,
  mirrorPutMany,
  mirrorMergeMany,
  mirrorDelete,
  mirrorDeleteMany,
  mirrorGetKV,
  mirrorSetKV,
  indexGetAll,
  SyncQueue
} from "./sync-queue.js"
import { DEFAULT_SETTINGS, uuid } from "./store-common.js"
import { normalizeFolderRecord, normalizeBoxRecord } from "../lib/folder-icons.js"
import { resizeImage, blobToDataURL } from "../lib/image-utils.js"
import {
  isMissingFolderIconColumnError,
  isMissingBoxIdColumnError,
  isMissingBoxesTableError,
  isMissingBoxIconColumnError,
  withoutFolderIcon,
  withoutBoxId
} from "../lib/folder-errors.js"
import {
  buildFolderRecord,
  buildCardRecord,
  buildBoxRecord,
  buildNoteRecord,
  exportJSONPayload,
  validateImportJSON
} from "./store-contract.js"
import {
  countDueForFolder,
  countDueBetweenForFolder,
  countNewForFolder,
  buildReviewQueue,
  filterByFolder
} from "./srs-query.js"
import {
  findFolderByPackId,
  importVocabPack as doImportVocabPack,
  deleteVocabPack as doDeleteVocabPack,
  type VocabImportStore
} from "./store-vocab.js"
import { shuffle } from "../lib/shuffle.js"
import {
  REVIEW_CARD_FIELDS,
  upsertSrsMeta,
  removeSrsMeta,
  removeSrsMetaForFolder,
  countSrsMetaByFolder
} from "./srs-meta.js"
import { StoreCache } from "./store-cache.js"
import { buildHomeStats, type HomeStats } from "./home-stats.js"
import { invalidateDerivedCaches } from "./cache-invalidate.js"
import { getCardsByIds, hydrateWithMisses } from "./card-hydrate.js"
import { configureImageUrls } from "./image-url.js"
import { isYoutubeCard } from "../lib/youtube-import.js"
import type { Card, Folder, Box, Settings, Note } from "./types.js"
import type { SrsMeta } from "./srs-meta.js"
import type { Algo, SrsRow } from "../lib/srs.js"
import type { ProgressInfo } from "./store-vocab.js"
import type { MiniSupabase } from "./supabase.js"
import {
  CLOUD_SYNC_KEY,
  SRS_DELTA_SELECT,
  SYNCED_DELTA_SELECT,
  SYNCED_AT_FIELD,
  shouldUseCardsDelta,
  shouldUseNotesDelta,
  mergeSrsDelta,
  nextCardsWatermark,
  stampUpdatedAt,
  cardLwwFilter,
  noteLwwFilter,
  isMissingSyncedAtError,
  isMissingNotesTableError,
  isMissingNoteLinkError,
  type WatermarkKind
} from "./cloud-delta.js"
import {
  putNoteInMirror,
  deleteNoteFromMirror,
  listNotesFromMirror,
  searchNoteIdsInMirror,
  getNoteFromMirror,
  getNoteConflictsFromMirror,
  mergeNotePatch,
  makeConflictCopy,
  replaceNotesMirror,
  type ListNotesOpts
} from "./store-notes.js"
import { extractHashtags } from "../lib/note-links.js"
import {
  setActivityCloudSync,
  applyRemoteActivity,
  loadActivity,
  type ActivityData
} from "../lib/activity.js"
import {
  setReviewLogCloudSync,
  lastReviewTs,
  applyRemoteReviews,
  initReviewLog,
  toCloudEntry,
  type ReviewLogEntry
} from "../lib/review-log.js"
import { fetchSchemaVersion, schemaOutdatedMessage } from "./schema-version.js"

export { folderSaveErrorMessage } from "../lib/folder-errors.js"

export interface SyncState {
  pending: number
  failed: number
  offline: boolean
}

export interface SyncPayload {
  row?: unknown
  id?: string
  patch?: unknown
  urls?: string[]
  settings?: unknown
  url?: string
  path?: string
  blob?: Blob
  contentType?: string
  cardId?: string
  side?: string
  [key: string]: unknown
}

export class CloudStore {
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
  /** В схеме нет колонки synced_at (миграция 0011 не применена) — watermark по updated_at. */
  _syncedAtCloudUnsupported: boolean
  /** Таблицы notes ещё нет (миграция 0013). */
  _notesCloudUnsupported: boolean
  /** Колонок note_id/note_anchor на cards ещё нет. */
  _noteLinkCloudUnsupported: boolean
  /** Сколько карточек не удалось собрать в прошлой очереди повторения (диагностика). */
  _lastHydrateMisses: number
  _homeStatsCache: HomeStats | null
  _homeStatsCacheAlgo: Algo | null
  _srsMetaPersistTimer: ReturnType<typeof setTimeout> | null
  _activityPushTimer: ReturnType<typeof setTimeout> | null
  _bgSyncTail: Promise<void>
  /** Промис текущей фоновой синхронизации с облаком (если идёт). */
  _cloudSyncPromise: Promise<void> | null
  /** Текст баннера, если schema_meta ниже REQUIRED_SCHEMA_VERSION. */
  schemaWarning: string | null

  constructor(sb: MiniSupabase) {
    this.kind = "cloud"
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
    this._syncedAtCloudUnsupported = false
    this._notesCloudUnsupported = false
    this._noteLinkCloudUnsupported = false
    this._lastHydrateMisses = 0
    this._homeStatsCache = null
    this._homeStatsCacheAlgo = null
    this._srsMetaPersistTimer = null
    this._activityPushTimer = null
    this._bgSyncTail = Promise.resolve()
    this._cloudSyncPromise = null
    this.schemaWarning = null
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
    await mirrorSetKV(this.mirror, "srs_meta", this._srsMeta)
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

  onSyncChange(fn: (state: SyncState) => void) {
    this._onSyncChange = fn
  }
  /** Колбэк перерисовки текущего экрана после фоновой догрузки данных из облака. */
  onDataChange(fn: () => void) {
    this._onDataChange = fn
  }
  _emitDataChange() {
    if (!this._onDataChange) return
    try {
      this._onDataChange()
    } catch (e) {
      console.error("onDataChange failed:", e)
    }
  }

  async _notifySync() {
    if (!this._onSyncChange) return
    this._onSyncChange({
      pending: await this.pendingSync(),
      failed: await this.deadLetterCount(),
      offline: this._offline
    })
  }

  get offline() {
    return this._offline
  }

  async pendingSync() {
    if (!this.queue.db) return 0
    return this.queue.size()
  }

  async deadLetterCount() {
    if (!this.queue.db) return 0
    return this.queue.deadLetterCount()
  }

  async deadLetters() {
    if (!this.queue.db) return []
    return this.queue.deadLetters()
  }

  async retryDeadLetter(id: number) {
    if (!this.queue.db) return false
    const ok = await this.queue.retryDeadLetter(id)
    if (ok) await this.flushSync()
    await this._notifySync()
    return ok
  }

  async discardDeadLetter(id: number) {
    if (!this.queue.db) return false
    const ok = await this.queue.discardDeadLetter(id)
    await this._notifySync()
    return ok
  }

  async init() {
    this.mirror = await openMirrorDB()
    await this.queue.init(this.mirror)
    await this._loadCloudFlags()
    // Картинки карточек показываем по подписанным ссылкам — бакет приватный.
    configureImageUrls(this.sb)
    this.queue.onFlush((item) => this._executeSyncItem(item))
    this.queue.onDeadLetter(() => this._notifySync())
    window.addEventListener("online", () => this._onOnline())
    // Без этого слушателя offline-состояние возникало только после первого
    // упавшего запроса, поэтому баннер «нет сети» появлялся с задержкой.
    window.addEventListener("offline", () => this._onOffline())
    this._bindActivityCloudSync()
    this._bindReviewLogCloudSync()
    void initReviewLog()
    await this._checkSchemaVersion()
    await this._loadData()
  }

  /** Сверить schema_meta с REQUIRED_SCHEMA_VERSION — баннер для self-host. */
  async _checkSchemaVersion() {
    if (!navigator.onLine) return
    try {
      const current = await fetchSchemaVersion(this.sb)
      this.schemaWarning = schemaOutdatedMessage(current)
    } catch (e) {
      // Сеть/офлайн — не блокируем boot; soft-деградация по capability-флагам.
      if (!isNetworkError(e)) console.warn("schema version check failed:", e)
    }
  }

  /** Активность (календарь/серия) пишется в settings.data и едет между устройствами. */
  _bindActivityCloudSync() {
    setActivityCloudSync((data) => {
      if (this._activityPushTimer) clearTimeout(this._activityPushTimer)
      this._activityPushTimer = setTimeout(() => {
        this._activityPushTimer = null
        void this._pushActivityToCloud(data)
      }, 1000)
    })
  }

  /** Журнал повторений: push/remove через очередь синка (best-effort, не блокирует оценку). */
  _bindReviewLogCloudSync() {
    setReviewLogCloudSync({
      push: (entry) => {
        void this.queue.enqueue({ op: "logReview", payload: entry }).then(() => this.flushSync())
      },
      remove: (id) => {
        void this.queue
          .enqueue({ op: "removeReview", payload: { id } })
          .then(() => this.flushSync())
      }
    })
  }

  /** Подтянуть журнал повторений из облака (вызывать на экране статистики). */
  async syncReviewLogFromCloud(): Promise<number> {
    if (this._reviewLogCloudUnsupported || !this.sb.userId()) return 0
    try {
      const since = await lastReviewTs()
      const rows = await this.sb.select<ReviewLogEntry>(
        "review_log",
        "select=*&ts=gt." + since + "&order=ts.asc&limit=5000"
      )
      return await applyRemoteReviews(rows)
    } catch (e) {
      if (isReviewLogMissing(e)) {
        this._reviewLogCloudUnsupported = true
        await this._saveCloudFlags()
        return 0
      }
      if (isNetworkError(e)) return 0
      console.warn("review-log pull", e)
      return 0
    }
  }

  /** Все slim-SRS строки карточек — для прогноза нагрузки на экране статистики. */
  getAllSrsRows(): SrsRow[] {
    return (this._srsMeta || []) as unknown as SrsRow[]
  }

  async _pushActivityToCloud(data: ActivityData) {
    try {
      this.settings.activity = data
      await this.saveSettings(this.settings)
    } catch (e) {
      console.warn("activity cloud push", e)
    }
  }

  /** Слить activity из settings с локальной; если на устройстве больше — отправить в облако. */
  async _ingestRemoteActivity() {
    const remote = this.settings.activity
    const changed = await applyRemoteActivity(remote)
    const local = loadActivity()
    if (JSON.stringify(local) !== JSON.stringify(remote || { days: {} })) {
      await this._pushActivityToCloud(local)
    }
    return changed
  }

  /** Явно слить/отправить статистику дня (Знаю/Не знаю/серия). Вызывать после входа и с кнопки «Синхронизировать». */
  async syncActivityNow() {
    if (this._activityPushTimer) {
      clearTimeout(this._activityPushTimer)
      this._activityPushTimer = null
    }
    const changed = await this._ingestRemoteActivity()
    if (changed) this._emitDataChange()
    return changed
  }

  /**
   * Браузер сообщил, что сеть пропала. Раньше офлайн-состояние выставлялось
   * только после первого упавшего запроса, поэтому баннер «нет сети»
   * появлялся с задержкой, а до этого UI показывал «синхронизировано».
   */
  _onOffline() {
    if (this._offline) return
    this._offline = true
    this._notifySync()
  }

  async _onOnline() {
    this._offline = false
    await this.flushSync()
    try {
      await this._fetchFromCloud()
      this._notifySync()
      this._emitDataChange()
    } catch (e) {
      console.warn("[kar] cloud fetch on online failed:", e)
    }
  }

  async flushSync() {
    const r = await this.queue.flush()
    if (r.ok > 0 || r.fail > 0) this._notifySync()
    return r
  }

  async _loadData() {
    // Сначала быстрый локальный рендер из зеркала IndexedDB — мгновенно и работает офлайн.
    await this._loadFromMirror()
    this._offline = !navigator.onLine
    // Не блокируем старт сетью: показываем данные из зеркала сразу (даже если оно пустое),
    // а облако вместе с обновлением токена догружаем в фоне. При недоступном Supabase
    // старт не висит — данные подтянутся и экран обновится, когда бэкенд ответит.
    if (navigator.onLine) this._syncFromCloudInBackground()

    this._notifySync()
    if (this.settings.algo === "fsrs") {
      const { preloadFsrs } = await import("../lib/srs.js")
      preloadFsrs()
    }
  }

  /** Догружает данные из облака в фоне и обновляет UI, не блокируя первый экран. */
  _syncFromCloudInBackground() {
    const run = (async () => {
      try {
        await this._fetchFromCloud()
        this._offline = false
        await this.flushSync()
        this._notifySync()
        this._emitDataChange()
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true
          this._notifySync()
        } else console.error("Фоновая синхронизация не удалась:", e)
      }
    })()
    this._cloudSyncPromise = run.finally(() => {
      if (this._cloudSyncPromise === run) this._cloudSyncPromise = null
    })
  }

  /**
   * Дождаться текущей (или только что запущенной) синхронизации с облаком.
   * Нужно при первом входе, когда зеркало пустое — иначе home рисуется без папок.
   */
  async whenCloudReady() {
    if (this._cloudSyncPromise) {
      await this._cloudSyncPromise
      return
    }
    if (!navigator.onLine) return
    this._syncFromCloudInBackground()
    if (this._cloudSyncPromise) await this._cloudSyncPromise
  }

  async _fetchFromCloud() {
    const uid = this.sb.userId()
    if (!uid) throw new Error("Нет активной сессии")
    const sync = (await mirrorGetKV(this.mirror, CLOUD_SYNC_KEY)) as {
      fullAt?: number
      cardsAt?: number
      cardsAtKind?: WatermarkKind
      notesAt?: number
      notesAtKind?: WatermarkKind
    } | null
    const useDelta = shouldUseCardsDelta(sync, uid, Date.now(), this._watermarkKind())
    const useNotesDelta = shouldUseNotesDelta(sync, uid, Date.now(), this._watermarkKind())

    const [folders, settingsRows, boxesRaw, cardsPull, notesPull] = await Promise.all([
      this.sb.select<Folder>("folders", "select=*&order=created_at.asc"),
      this.sb.select<{ data?: Settings }>("settings", "select=*&user_id=eq." + uid),
      this._fetchBoxesFromCloud(),
      // `?? 0` — не «сейчас»: часы устройства не должны попадать в watermark.
      useDelta ? this._pullCardsDelta(uid, sync?.cardsAt ?? 0) : this._pullCardsFull(),
      useNotesDelta ? this._pullNotesDelta(uid, sync?.notesAt ?? 0) : this._pullNotesFull()
    ])

    this.folders = folders.map(normalizeFolderRecord).filter((f): f is Folder => !!f)
    this.boxes = boxesRaw
      .map(normalizeBoxRecord)
      .filter((b): b is Box => !!b)
      .sort((a: Box, b: Box) => (a.created_at || 0) - (b.created_at || 0))
    if (folders.some((f: Folder) => Object.prototype.hasOwnProperty.call(f, "icon"))) {
      this._folderIconCloudUnsupported = false
      await this._saveCloudFlags()
    }
    // В зеркало кладём нормализованные записи — так же, как boxes ниже.
    // Сырые строки без icon/box_id приводили к тому, что после перезагрузки
    // (чтение из зеркала) папка выглядела иначе, чем сразу после синка.
    await mirrorReplaceAll(this.mirror, "folders", this.folders)
    await mirrorReplaceAll(this.mirror, "boxes", this.boxes)
    if (notesPull.rows) await replaceNotesMirror(this.mirror, notesPull.rows)
    this._srsMeta = cardsPull.meta
    this._cache.clearAll()
    for (const [fid, n] of countSrsMetaByFolder(cardsPull.meta, folders)) {
      this._cache.setCount(fid, n)
    }
    invalidateDerivedCaches(this)
    const settingsRow = settingsRows[0]
    if (settingsRow?.data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsRow.data)
    }
    await mirrorSetKV(this.mirror, "settings", this.settings)
    await this._ingestRemoteActivity()
    await mirrorSetKV(this.mirror, "srs_meta", cardsPull.meta)
    const now = Date.now()
    await mirrorSetKV(this.mirror, CLOUD_SYNC_KEY, {
      userId: uid,
      cardsAt: cardsPull.cardsAt,
      cardsAtKind: cardsPull.cardsAtKind,
      notesAt: notesPull.notesAt,
      notesAtKind: notesPull.notesAtKind,
      fullAt: cardsPull.full ? now : (sync?.fullAt ?? now)
    })
    this._offline = false
  }

  /**
   * По каким часам строим watermark.
   *
   * synced_at ставит серверный триггер (миграция 0011) — единые часы для всех
   * устройств. updated_at пишет клиент, поэтому правка с отставшими часами
   * приезжает «в прошлое» и мимо окна дельты; это запасной режим для схем без
   * миграции.
   */
  _watermarkKind(): WatermarkKind {
    return this._syncedAtCloudUnsupported ? "updated_at" : SYNCED_AT_FIELD
  }

  _cardsSelect(): string {
    return this._syncedAtCloudUnsupported ? SRS_DELTA_SELECT : SYNCED_DELTA_SELECT
  }

  /** SELECT slim-проекции карточек; нет колонки synced_at — запоминаем и повторяем без неё. */
  async _selectCardsProjection(filter: string): Promise<SrsRow[]> {
    const prefix = filter ? filter + "&" : ""
    try {
      return await this.sb.select<SrsRow>("cards", prefix + "select=" + this._cardsSelect())
    } catch (e) {
      if (this._syncedAtCloudUnsupported || !isMissingSyncedAtError(e)) throw e
      this._syncedAtCloudUnsupported = true
      await this._saveCloudFlags()
      return this.sb.select<SrsRow>("cards", prefix + "select=" + SRS_DELTA_SELECT)
    }
  }

  async _pullCardsFull() {
    const rows = await this._selectCardsProjection("")
    // Вид часов мог смениться внутри запроса (колонки synced_at не оказалось).
    const kind = this._watermarkKind()
    const { meta, maxAt, maxSyncedAt } = mergeSrsDelta([], rows)
    const observed = kind === "synced_at" ? maxSyncedAt : maxAt
    return {
      meta,
      cardsAt: nextCardsWatermark(0, observed, { kind }),
      cardsAtKind: kind,
      full: true
    }
  }

  async _pullNotesFull(): Promise<{
    rows: Note[] | null
    notesAt: number
    notesAtKind: WatermarkKind
    full: boolean
  }> {
    const kind = this._watermarkKind()
    if (this._notesCloudUnsupported) {
      return { rows: null, notesAt: 0, notesAtKind: kind, full: true }
    }
    try {
      const rows = await this.sb.select<Note>("notes", "select=*&order=updated_at.asc")
      let maxAt = 0
      let maxSyncedAt = 0
      for (const n of rows) {
        if ((n.updated_at || 0) > maxAt) maxAt = n.updated_at || 0
        if ((n.synced_at || 0) > maxSyncedAt) maxSyncedAt = n.synced_at || 0
      }
      const observed = kind === "synced_at" ? maxSyncedAt : maxAt
      return {
        rows,
        notesAt: nextCardsWatermark(0, observed, { kind }),
        notesAtKind: kind,
        full: true
      }
    } catch (e) {
      if (isMissingNotesTableError(e)) {
        this._notesCloudUnsupported = true
        await this._saveCloudFlags()
        return { rows: null, notesAt: 0, notesAtKind: kind, full: true }
      }
      throw e
    }
  }

  async _pullNotesDelta(
    uid: string,
    since: number
  ): Promise<{ rows: Note[] | null; notesAt: number; notesAtKind: WatermarkKind; full: boolean }> {
    const kind = this._watermarkKind()
    if (this._notesCloudUnsupported) {
      return { rows: null, notesAt: since, notesAtKind: kind, full: false }
    }
    try {
      const field = kind === "synced_at" ? "synced_at" : "updated_at"
      const delta = await this.sb.select<Note>(
        "notes",
        "user_id=eq." + uid + "&" + field + "=gt." + since + "&order=" + field + ".asc"
      )
      if (!delta.length) {
        return { rows: null, notesAt: since, notesAtKind: kind, full: false }
      }
      // Мержим дельту в зеркало поштучно, полный replace не нужен.
      for (const n of delta) {
        const local = Object.assign({}, n)
        delete (local as { synced_at?: number }).synced_at
        await putNoteInMirror(this.mirror, local)
      }
      let maxAt = since
      let maxSyncedAt = since
      for (const n of delta) {
        if ((n.updated_at || 0) > maxAt) maxAt = n.updated_at || 0
        if ((n.synced_at || 0) > maxSyncedAt) maxSyncedAt = n.synced_at || 0
      }
      const observed = kind === "synced_at" ? maxSyncedAt : maxAt
      return {
        rows: null, // уже влили
        notesAt: nextCardsWatermark(since, observed, { kind }),
        notesAtKind: kind,
        full: false
      }
    } catch (e) {
      if (isMissingNotesTableError(e)) {
        this._notesCloudUnsupported = true
        await this._saveCloudFlags()
        return { rows: null, notesAt: 0, notesAtKind: kind, full: true }
      }
      return this._pullNotesFull()
    }
  }

  /**
   * Pull only cards changed after the watermark, merge into mirror srs_meta.
   * Falls back to full when remote count disagrees (deletes) or query fails.
   */
  async _pullCardsDelta(uid: string, since: number) {
    const kind = this._watermarkKind()
    try {
      const base = this._srsMeta || (await mirrorGetKV(this.mirror, "srs_meta")) || []
      const [delta, remoteCount] = await Promise.all([
        this._selectCardsProjection("user_id=eq." + uid + "&" + kind + "=gt." + since),
        this.sb.count("cards", "user_id=eq." + uid)
      ])
      const { meta, maxAt, maxSyncedAt } = mergeSrsDelta(
        base as SrsMeta[] | null | undefined,
        delta
      )
      if (remoteCount !== meta.length) return this._pullCardsFull()
      const observed = kind === "synced_at" ? maxSyncedAt : maxAt
      return {
        meta,
        cardsAt: nextCardsWatermark(since, observed, { kind }),
        cardsAtKind: kind,
        full: false
      }
    } catch (e) {
      if (isNetworkError(e)) throw e
      if (!this._syncedAtCloudUnsupported && isMissingSyncedAtError(e)) {
        this._syncedAtCloudUnsupported = true
        await this._saveCloudFlags()
      }
      return this._pullCardsFull()
    }
  }

  async _fetchBoxesFromCloud() {
    try {
      const rows = await this.sb.select<Box>("boxes", "select=*&order=created_at.asc")
      if (this._boxesCloudUnsupported) {
        this._boxesCloudUnsupported = false
        await this._saveCloudFlags()
      }
      return rows
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true
        await this._saveCloudFlags()
      }
      try {
        if (this.mirror) return await getAll<Box>(this.mirror, "boxes")
      } catch (e2) {
        /* mirror empty */
      }
      return []
    }
  }

  async _loadFromMirror() {
    this.folders = ((await getAll(this.mirror, "folders")) as (Folder | null | undefined)[])
      .map(normalizeFolderRecord)
      .filter((f): f is Folder => !!f)
    this.folders.sort((a: Folder, b: Folder) => (a.created_at || 0) - (b.created_at || 0))
    this.boxes = ((await getAll(this.mirror, "boxes")) as (Box | null | undefined)[])
      .map(normalizeBoxRecord)
      .filter((b): b is Box => !!b)
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    const settings = await mirrorGetKV(this.mirror, "settings")
    if (settings) this.settings = Object.assign({}, DEFAULT_SETTINGS, settings as Partial<Settings>)
    await this._ingestRemoteActivity()
    const meta = await mirrorGetKV(this.mirror, "srs_meta")
    this._srsMeta = (meta as SrsMeta[] | null) || []
    this._cache.clearAll()
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta)
    this._offline = true
  }

  /**
   * Apply localFn first. Online: wait for cloud unless `optimistic` (UI returns after
   * mirror; network runs in a serialized background chain). Offline / network error → queue.
   */
  async _cloudOrQueue(
    op: string,
    payload: unknown,
    localFn: () => Promise<unknown>,
    { optimistic = false }: { optimistic?: boolean } = {}
  ) {
    const result = await localFn()
    if (!navigator.onLine) {
      this._offline = true
      await this.queue.enqueue({ op, payload })
      this._notifySync()
      return result
    }
    if (optimistic) {
      this._syncInBackground(op, payload)
      return result
    }
    try {
      await this._executeSyncItem({ op, payload })
      this._offline = false
      return result
    } catch (e) {
      if (isNetworkError(e)) {
        this._offline = true
        await this.queue.enqueue({ op, payload })
        this._notifySync()
        return result
      }
      throw e
    }
  }

  /** Serialized fire-and-forget cloud op; on failure falls back to SyncQueue. */
  _syncInBackground(op: string, payload: unknown) {
    const run = async () => {
      try {
        await this._executeSyncItem({ op, payload })
        this._offline = false
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true
          await this.queue.enqueue({ op, payload })
          this._notifySync()
          return
        }
        await this.queue.enqueue({ op, payload })
        this._notifySync()
        try {
          await this.flushSync()
        } catch (_) {
          /* dead-letter / still pending */
        }
      }
    }
    this._bgSyncTail = this._bgSyncTail.then(run, run)
  }

  async _loadCloudFlags() {
    if (!this.mirror) return
    const flags = (await mirrorGetKV(this.mirror, "cloud_flags")) as {
      folderIconCloudUnsupported?: boolean
      boxesCloudUnsupported?: boolean
      boxIdCloudUnsupported?: boolean
      boxIconCloudUnsupported?: boolean
      reviewLogCloudUnsupported?: boolean
      syncedAtCloudUnsupported?: boolean
      notesCloudUnsupported?: boolean
      noteLinkCloudUnsupported?: boolean
    } | null
    this._folderIconCloudUnsupported = !!flags?.folderIconCloudUnsupported
    this._boxesCloudUnsupported = !!flags?.boxesCloudUnsupported
    this._boxIdCloudUnsupported = !!flags?.boxIdCloudUnsupported
    this._boxIconCloudUnsupported = !!flags?.boxIconCloudUnsupported
    this._reviewLogCloudUnsupported = !!flags?.reviewLogCloudUnsupported
    this._syncedAtCloudUnsupported = !!flags?.syncedAtCloudUnsupported
    this._notesCloudUnsupported = !!flags?.notesCloudUnsupported
    this._noteLinkCloudUnsupported = !!flags?.noteLinkCloudUnsupported
  }

  async _saveCloudFlags() {
    if (!this.mirror) return
    await mirrorSetKV(this.mirror, "cloud_flags", {
      folderIconCloudUnsupported: !!this._folderIconCloudUnsupported,
      boxesCloudUnsupported: !!this._boxesCloudUnsupported,
      boxIdCloudUnsupported: !!this._boxIdCloudUnsupported,
      boxIconCloudUnsupported: !!this._boxIconCloudUnsupported,
      reviewLogCloudUnsupported: !!this._reviewLogCloudUnsupported,
      syncedAtCloudUnsupported: !!this._syncedAtCloudUnsupported,
      notesCloudUnsupported: !!this._notesCloudUnsupported,
      noteLinkCloudUnsupported: !!this._noteLinkCloudUnsupported
    })
  }

  async _cloudInsertFolder(row: Folder) {
    let payload = row
    if (this._folderIconCloudUnsupported) payload = withoutFolderIcon(row)
    try {
      await this.sb.insert("folders", payload)
    } catch (e) {
      if (
        !this._folderIconCloudUnsupported &&
        isMissingFolderIconColumnError(e) &&
        row &&
        "icon" in row
      ) {
        this._folderIconCloudUnsupported = true
        await this._saveCloudFlags()
        await this.sb.insert("folders", withoutFolderIcon(row))
        return
      }
      throw e
    }
  }

  async _cloudPatchFolder(id: string, patch: Partial<Folder>) {
    let payload = Object.assign({}, patch)
    if (this._folderIconCloudUnsupported) payload = withoutFolderIcon(payload)
    if (this._boxIdCloudUnsupported) payload = withoutBoxId(payload)
    if (!Object.keys(payload).length) return
    try {
      await this.sb.update("folders", "id=eq." + id, payload)
    } catch (e) {
      if (
        !this._folderIconCloudUnsupported &&
        isMissingFolderIconColumnError(e) &&
        patch &&
        "icon" in patch
      ) {
        this._folderIconCloudUnsupported = true
        await this._saveCloudFlags()
        await this._cloudPatchFolder(id, withoutFolderIcon(patch))
        return
      }
      if (
        !this._boxIdCloudUnsupported &&
        isMissingBoxIdColumnError(e) &&
        patch &&
        "box_id" in patch
      ) {
        this._boxIdCloudUnsupported = true
        await this._saveCloudFlags()
        await this._cloudPatchFolder(id, withoutBoxId(patch))
        return
      }
      throw e
    }
  }

  async _cloudInsertBox(row: Box) {
    if (this._boxesCloudUnsupported) return
    let payload = row
    if (this._boxIconCloudUnsupported) payload = withoutFolderIcon(row)
    try {
      await this.sb.insert("boxes", payload)
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      if (
        !this._boxIconCloudUnsupported &&
        isMissingBoxIconColumnError(e) &&
        row &&
        "icon" in row
      ) {
        this._boxIconCloudUnsupported = true
        await this._saveCloudFlags()
        await this._cloudInsertBox(withoutFolderIcon(row))
        return
      }
      throw e
    }
  }

  async _cloudUpdateBox(id: string, patch: Partial<Box>) {
    if (this._boxesCloudUnsupported) return
    let payload = Object.assign({}, patch)
    if (this._boxIconCloudUnsupported) payload = withoutFolderIcon(payload)
    if (!Object.keys(payload).length) return
    try {
      await this.sb.update("boxes", "id=eq." + id, payload)
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      if (
        !this._boxIconCloudUnsupported &&
        isMissingBoxIconColumnError(e) &&
        patch &&
        "icon" in patch
      ) {
        this._boxIconCloudUnsupported = true
        await this._saveCloudFlags()
        await this._cloudUpdateBox(id, withoutFolderIcon(patch))
        return
      }
      throw e
    }
  }

  async _cloudDeleteBox(id: string) {
    if (this._boxesCloudUnsupported) return
    try {
      await this.sb.remove("boxes", "id=eq." + id)
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      throw e
    }
  }

  async _executeSyncItem({ op, payload }: { op: string; payload: any }) {
    switch (op) {
      case "createFolder":
        await this._cloudInsertFolder(payload.row)
        break
      case "updateFolder":
        await this._cloudPatchFolder(payload.id, payload.patch)
        break
      case "deleteFolder":
        await this.sb.remove("cards", "folder_id=eq." + payload.id)
        await this.sb.remove("folders", "id=eq." + payload.id)
        break
      case "createBox":
        await this._cloudInsertBox(payload.row)
        break
      case "updateBox":
        await this._cloudUpdateBox(payload.id, payload.patch)
        break
      case "deleteBox":
        await this._cloudDeleteBox(payload.id)
        break
      case "createCard":
        await this.sb.insert("cards", payload.row)
        break
      case "updateCard":
        await this._cloudPatchCardLww(payload.id, payload.patch)
        break
      case "deleteCard":
        if (payload.urls) for (const url of payload.urls) await this.deleteImage(url)
        await this.sb.remove("cards", "id=eq." + payload.id)
        break
      case "createNote":
        await this._cloudInsertNote(payload.row)
        break
      case "updateNote":
        await this._cloudPatchNoteLww(payload.id, payload.patch, payload.loser)
        break
      case "deleteNote":
        await this._cloudDeleteNote(payload.id)
        break
      case "saveSettings":
        await this._cloudSaveSettings(payload.settings)
        break
      case "uploadImage":
        payload.url = await this.sb.uploadFile(
          "card-images",
          payload.path,
          payload.blob,
          payload.contentType
        )
        if (payload.cardId && payload.side) {
          await this._applyUploadedImage(payload.cardId, payload.side, payload.url)
        }
        break
      case "logReview":
        await this._cloudLogReview(payload as ReviewLogEntry)
        break
      case "removeReview":
        await this._cloudRemoveReview(payload.id)
        break
      default:
        throw new Error("Unknown sync op: " + op)
    }
  }

  /**
   * PATCH карточки по правилу «побеждает последняя правка».
   *
   * Фильтр требует, чтобы сохранённая на сервере updated_at была строго меньше
   * нашей. Если на другом устройстве уже записали более свежую версию,
   * PostgREST не тронет ни одной строки — и залежавшаяся в офлайн-очереди
   * правка не затрёт чужую. Пустой ответ здесь НЕ ошибка: элемент очереди
   * считается выполненным (иначе он либо крутился бы вечно, либо уехал в
   * dead-letter), а победившую удалённую версию мы принимаем у себя.
   *
   * Именно ради различения «изменили 1 строку» и «изменили 0 строк» здесь
   * нужен returning: 'representation' — при return=minimal ответ пустой всегда.
   */
  async _cloudPatchCardLww(id: string, patch: Record<string, unknown>) {
    let payload = Object.assign({}, patch)
    if (this._noteLinkCloudUnsupported) {
      delete payload.note_id
      delete payload.note_anchor
    }
    try {
      const rows = await this.sb.update("cards", cardLwwFilter(id, payload), payload, {
        returning: "representation"
      })
      if (!Array.isArray(rows) || rows.length > 0) return
      await this._adoptRemoteCard(id)
    } catch (e) {
      if (!this._noteLinkCloudUnsupported && isMissingNoteLinkError(e)) {
        this._noteLinkCloudUnsupported = true
        await this._saveCloudFlags()
        delete payload.note_id
        delete payload.note_anchor
        if (!Object.keys(payload).length) return
        await this._cloudPatchCardLww(id, payload)
        return
      }
      throw e
    }
  }

  async _cloudInsertNote(row: Note) {
    if (this._notesCloudUnsupported) return
    const payload = Object.assign({}, row) as Note & { synced_at?: number }
    delete payload.synced_at
    try {
      await this.sb.insert("notes", payload)
    } catch (e) {
      if (isMissingNotesTableError(e)) {
        this._notesCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      throw e
    }
  }

  /**
   * LWW-патч заметки. При проигрыше: принять remote и сохранить loser как conflict-копию.
   */
  async _cloudPatchNoteLww(
    id: string,
    patch: Record<string, unknown>,
    loser?: Partial<Note> | null
  ) {
    if (this._notesCloudUnsupported) return
    try {
      const rows = await this.sb.update("notes", noteLwwFilter(id, patch), patch, {
        returning: "representation"
      })
      if (!Array.isArray(rows) || rows.length > 0) return
      await this._adoptRemoteNote(id, loser || null)
    } catch (e) {
      if (isMissingNotesTableError(e)) {
        this._notesCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      throw e
    }
  }

  async _adoptRemoteNote(id: string, loser: Partial<Note> | null) {
    let remote: Note | undefined
    try {
      const rows = await this.sb.select<Note>("notes", "id=eq." + id + "&select=*&limit=1")
      remote = rows[0]
    } catch (e) {
      if (isNetworkError(e)) throw e
      console.warn("[sync] не удалось получить облачную версию заметки", id, e)
      return
    }
    if (!remote) {
      console.warn("[sync] заметки нет в облаке, правка отброшена:", id)
      return
    }
    const clean = Object.assign({}, remote) as Note & { synced_at?: number }
    delete clean.synced_at
    if (loser && (loser.body != null || loser.title != null)) {
      const copy = makeConflictCopy(id, loser)
      copy.user_id = this.sb.userId() || undefined
      await putNoteInMirror(this.mirror, copy)
      await this._cloudInsertNote(copy)
    }
    await putNoteInMirror(this.mirror, clean)
    this._emitDataChange()
  }

  async _cloudDeleteNote(id: string) {
    if (this._notesCloudUnsupported) return
    try {
      await this.sb.remove("notes", "conflict_of=eq." + id)
      await this.sb.remove("notes", "id=eq." + id)
    } catch (e) {
      if (isMissingNotesTableError(e)) {
        this._notesCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      throw e
    }
  }

  /** Принять облачную версию карточки как победившую: зеркало, кэш, SRS-мета. */
  async _adoptRemoteCard(id: string) {
    let remote: Card | undefined
    try {
      const rows = await this.sb.select<Card>("cards", "id=eq." + id + "&select=*&limit=1")
      remote = rows[0]
    } catch (e) {
      if (isNetworkError(e)) throw e // очередь повторит позже
      console.warn("[sync] не удалось получить облачную версию карточки", id, e)
      return
    }
    if (!remote) {
      // Карточку удалили на другом устройстве — локальную не трогаем, её уберёт
      // ближайшая полная сверка (расхождение количества в _pullCardsDelta).
      console.warn("[sync] карточки нет в облаке, правка отброшена:", id)
      return
    }
    await mirrorPut(this.mirror, "cards", remote)
    this._patchSrsMeta(remote)
    this._cache.patchCardInLists(id, remote)
    invalidateDerivedCaches(this, { folderId: remote.folder_id })
    this._emitDataChange()
  }

  /**
   * Подставить настоящую ссылку вместо временного data:-URL, оставшегося в
   * карточке после офлайн-загрузки картинки — и в облаке, и локально.
   */
  async _applyUploadedImage(cardId: string, side: string, url: string) {
    const patch = stampUpdatedAt({ [side]: url })
    await this._cloudPatchCardLww(cardId, patch)
    const card = await this._getCardById(cardId)
    if (!card) return
    Object.assign(card, patch as Partial<Card>)
    await mirrorPut(this.mirror, "cards", card)
    this._cache.patchCardInLists(cardId, patch as Partial<Card>)
    this._emitDataChange()
  }

  async _cloudLogReview(entry: ReviewLogEntry) {
    if (this._reviewLogCloudUnsupported) return
    const uid = this.sb.userId()
    if (!uid) throw new Error("Нет активной сессии — войдите снова")
    try {
      // toCloudEntry срезает локальные поля (duration_ms, format): их нет в
      // схеме review_log, а неизвестная колонка вернула бы 42703, что код
      // ниже принял бы за «таблицы нет» и отключил синхронизацию журнала.
      await this.sb.upsert("review_log", Object.assign({ user_id: uid }, toCloudEntry(entry)), {
        onConflict: "id"
      })
    } catch (e) {
      if (isReviewLogMissing(e)) {
        this._reviewLogCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      throw e
    }
  }

  async _cloudRemoveReview(id: string) {
    if (this._reviewLogCloudUnsupported) return
    try {
      await this.sb.remove("review_log", "id=eq." + id)
    } catch (e) {
      if (isReviewLogMissing(e)) {
        this._reviewLogCloudUnsupported = true
        await this._saveCloudFlags()
        return
      }
      throw e
    }
  }

  async _cloudSaveSettings(settings: unknown) {
    const uid = this.sb.userId()
    if (!uid) throw new Error("Нет активной сессии — войдите снова")
    const row = {
      user_id: uid,
      data: settings,
      updated_at: Date.now()
    }
    const push = async () => {
      // on_conflict обязателен для upsert под RLS; иначе PostgREST часто делает INSERT и падает.
      try {
        await this.sb.upsert("settings", row, { onConflict: "user_id" })
        return
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!/row-level security|42501/i.test(msg)) throw e
      }
      // Fallback: UPDATE, при пустом ответе — INSERT (надёжнее при глюках upsert+RLS).
      try {
        await this.sb.update("settings", "user_id=eq." + uid, {
          data: settings,
          updated_at: row.updated_at
        })
      } catch (e) {
        /* try insert below */
      }
      try {
        await this.sb.insert("settings", row)
      } catch (e2) {
        // Строка уже есть — повторный update
        await this.sb.update("settings", "user_id=eq." + uid, {
          data: settings,
          updated_at: Date.now()
        })
      }
    }
    try {
      await push()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/row-level security|42501|JWT|session|401|403/i.test(msg)) {
        try {
          await this.sb.refresh()
          await push()
          return
        } catch (e2) {
          throw e2 instanceof Error ? e2 : e
        }
      }
      throw e
    }
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
        cards = await this.sb.select<Card>(
          "cards",
          "folder_id=eq." + folderId + "&order=created_at.desc"
        )
        await mirrorPutMany(this.mirror, "cards", cards)
        await this._reconcileFolderMirror(folderId, cards)
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true
          cards = await indexGetAll<Card>(this.mirror, "cards", "folder_id", folderId ?? "")
        } else throw e
      }
    } else {
      cards = await indexGetAll<Card>(this.mirror, "cards", "folder_id", folderId)
    }
    cards.sort((a: Card, b: Card) => (b.created_at || 0) - (a.created_at || 0))
    this._cache.folderCache.set(folderId, cards)
    return cards
  }

  /**
   * Выкинуть из зеркала карточки папки, которых больше нет в облаке (удалены с
   * другого устройства). Без этого удалённая карточка жила в зеркале вечно:
   * сюда мы только дописываем, а полная сверка ловит расхождение лишь по
   * количеству — удаление плюс создание давало ту же цифру.
   *
   * Пока в очереди есть неотправленные операции, сверку пропускаем: созданная
   * офлайн карточка в облаке ещё не существует, и удалять её нельзя.
   */
  async _reconcileFolderMirror(folderId: string, remote: Card[]) {
    if (await this.pendingSync()) return
    const alive = new Set(remote.map((c) => c.id))
    const local = await indexGetAll<Card>(this.mirror, "cards", "folder_id", folderId ?? "")
    const stale = local.filter((c) => c.id && !alive.has(c.id)).map((c) => c.id!)
    if (!stale.length) return
    await mirrorDeleteMany(this.mirror, "cards", stale)
    for (const id of stale) this._patchSrsMetaRemoval(id)
    await this._flushSrsMetaPersist()
    this._cache.setCount(folderId, remote.length)
    invalidateDerivedCaches(this, { folderId })
  }

  /** Догрузка карточек из облака по id (пачками) + запись в зеркало. */
  async _fetchCardsByIds(ids: string[]): Promise<Card[]> {
    if (!ids?.length || !navigator.onLine || this._offline) return []
    const out: Card[] = []
    const CHUNK = 50
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK)
        const rows = await this.sb.select<Card>(
          "cards",
          "id=in.(" + chunk.map(encodeURIComponent).join(",") + ")"
        )
        out.push(...rows)
      }
    } catch (e) {
      if (isNetworkError(e)) this._offline = true
      else console.warn("[sync] не удалось догрузить карточки из облака:", e)
    }
    if (out.length)
      await mirrorMergeMany(this.mirror, "cards", out as unknown as Record<string, unknown>[])
    return out
  }

  /**
   * Собрать карточки очередей по slim-строкам SRS, добирая из облака то, чего
   * нет в зеркале. Раньше такие карточки просто выпадали из повторения — молча
   * и навсегда, пока не случится полная пересинхронизация.
   * Что всё же не собралось — считаем в _lastHydrateMisses (и пишем в консоль).
   */
  async _hydrateQueues(groups: SrsRow[][]): Promise<Card[][]> {
    const ids: (string | undefined)[] = []
    for (const g of groups) for (const row of g) ids.push(row.id)
    const byId = await getCardsByIds(this.mirror, this._cache, ids, {
      fetchMissing: (missing) => this._fetchCardsByIds(missing)
    })
    let missed = 0
    const out: Card[][] = []
    for (const g of groups) {
      const { cards, missing } = hydrateWithMisses(g, byId)
      missed += missing.length
      out.push(cards)
    }
    this._lastHydrateMisses = missed
    return out
  }

  /** Сколько карточек не удалось собрать в последней очереди повторения. */
  lastHydrateMisses() {
    return this._lastHydrateMisses
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
        const prefix = folderId
          ? "folder_id=eq." + folderId + "&user_id=eq." + uid
          : "user_id=eq." + uid
        const sel = "&select=" + REVIEW_CARD_FIELDS
        const dueQ =
          algo === "leitner"
            ? prefix + "&box=gt.0&box_due=lte." + now + sel
            : algo === "fsrs"
              ? prefix + "&fsrs_due=not.is.null&fsrs_due=lte." + now + sel
              : prefix + "&sm2_due=not.is.null&sm2_due=lte." + now + sel
        const newQ =
          algo === "leitner"
            ? prefix + "&box=eq.0" + sel + "&limit=" + newLimit
            : algo === "fsrs"
              ? prefix + "&fsrs_reps=is.null&fsrs_due=is.null" + sel + "&limit=" + newLimit
              : prefix + "&sm2_reps=eq.0&sm2_due=is.null" + sel + "&limit=" + newLimit
        const [dueCards, newCards] = await Promise.all([
          this.sb.select("cards", dueQ),
          this.sb.select("cards", newQ)
        ])
        // Это ПРОЕКЦИЯ (REVIEW_CARD_FIELDS), а не полная строка: простой put
        // затирал в зеркале поля, которых в проекции нет. Доливаем в имеющиеся.
        await mirrorMergeMany(
          this.mirror,
          "cards",
          dueCards.concat(newCards) as Record<string, unknown>[]
        )
        this._lastHydrateMisses = 0
        return { due: shuffle(dueCards), fresh: shuffle(newCards).slice(0, newLimit) }
      } catch (e) {
        if (!isNetworkError(e)) throw e
        this._offline = true
      }
    }

    const source = filterByFolder(this._srsMeta || [], folderId)
    const { due, fresh } = buildReviewQueue(source, algo, newLimit, now)
    const [dueCards, freshCards] = await this._hydrateQueues([due, fresh])
    return { due: dueCards ?? [], fresh: freshCards ?? [] }
  }

  async getCramCards(folderId: string | null, limit: number | null) {
    // Выборку строим по slim-мете: она полная (её тянет синк целиком), поэтому
    // случайность честная. Из сети берём только тела недостающих карточек —
    // limit на стороне сервера отдавал бы всегда одни и те же первые N.
    const source = filterByFolder(this._srsMeta || [], folderId)
    const picked = shuffle(source)
    const slice = (limit ?? 0) > 0 ? picked.slice(0, limit as number) : picked
    const [cards] = await this._hydrateQueues([slice])
    return cards ?? []
  }

  async scanFolderFronts(
    folderId: string | null,
    { youtubeOnly = false }: { youtubeOnly?: boolean } = {}
  ) {
    if (navigator.onLine && !this._offline) {
      try {
        const rows = (await this.sb.select(
          "cards",
          "folder_id=eq." + folderId + "&select=front,description"
        )) as Card[]
        return rows
          .filter((c) => !youtubeOnly || isYoutubeCard(c))
          .filter((c) => c.front)
          .map((c) => ({ front: c.front }))
      } catch (e) {
        if (!isNetworkError(e)) throw e
        this._offline = true
      }
    }
    const cards = (await indexGetAll(this.mirror, "cards", "folder_id", folderId ?? "")) as Card[]
    const mini = []
    for (const c of cards) {
      if (youtubeOnly && !isYoutubeCard(c)) continue
      if (c.front) mini.push({ front: c.front })
    }
    return mini
  }

  async _getCardById(id: string): Promise<Card | null> {
    for (const list of this._cache.folderCache.values()) {
      const c = list.find((x) => x.id === id)
      if (c) return c
    }
    return new Promise((resolve, reject) => {
      const req = this.mirror.transaction("cards").objectStore("cards").get(id)
      req.onsuccess = () => resolve((req.result as Card | null) || null)
      req.onerror = () => reject(req.error)
    })
  }

  async createFolder(data: Partial<Folder>) {
    const row = buildFolderRecord(data, { user_id: this.sb.userId() })
    this.folders.push(row)
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    this._cache.setCount(row.id, 0)
    await mirrorPut(this.mirror, "folders", row)
    return this._cloudOrQueue("createFolder", { row }, async () => row)
  }

  async updateFolder(id: string, patch: Partial<Folder>) {
    const f = this.folders.find((x) => x.id === id)
    if (!f) return null
    const stamped = stampUpdatedAt(patch)
    Object.assign(f, stamped)
    await mirrorPut(this.mirror, "folders", f)
    return this._cloudOrQueue("updateFolder", { id, patch: stamped }, async () => f)
  }

  async deleteFolder(id: string) {
    const dead = (await indexGetAll(this.mirror, "cards", "folder_id", id)) as Card[]
    await Promise.all(dead.map((c) => this._removeCardImages(c)))
    await mirrorDeleteMany(
      this.mirror,
      "cards",
      dead.map((c) => c.id!)
    )
    await mirrorDelete(this.mirror, "folders", id)
    this.folders = this.folders.filter((f) => f.id !== id)
    this._cache.deleteFolder(id)
    if (this._srsMeta) {
      this._srsMeta = removeSrsMetaForFolder(this._srsMeta, id)
      await this._flushSrsMetaPersist()
    }
    invalidateDerivedCaches(this, { folderId: id })
    return this._cloudOrQueue("deleteFolder", { id }, async () => true)
  }

  async createBox(data: Partial<Box>) {
    const row = buildBoxRecord(data, { user_id: this.sb.userId() })
    this.boxes.push(row)
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    await mirrorPut(this.mirror, "boxes", row)
    if (this._boxesCloudUnsupported) return row
    return this._cloudOrQueue("createBox", { row }, async () => row)
  }

  async updateBox(id: string, patch: Partial<Box>) {
    const b = this.boxes.find((x) => x.id === id)
    if (!b) return null
    const stamped = stampUpdatedAt(patch)
    Object.assign(b, stamped)
    await mirrorPut(this.mirror, "boxes", b)
    if (this._boxesCloudUnsupported) return b
    return this._cloudOrQueue("updateBox", { id, patch: stamped }, async () => b)
  }

  async deleteBox(id: string) {
    for (const f of this.folders.filter((x) => x.box_id === id)) {
      f.box_id = undefined
      await mirrorPut(this.mirror, "folders", f)
    }
    await mirrorDelete(this.mirror, "boxes", id)
    this.boxes = this.boxes.filter((b) => b.id !== id)
    if (this._boxesCloudUnsupported) return true
    return this._cloudOrQueue("deleteBox", { id }, async () => true)
  }

  async assignFolderToBox(folderId: string, boxId?: string | null) {
    const f = this.folders.find((x) => x.id === folderId)
    if (!f) return null
    if (boxId && !this.boxes.find((b) => b.id === boxId)) return null
    const stamped = stampUpdatedAt({ box_id: boxId || null })
    Object.assign(f, stamped)
    await mirrorPut(this.mirror, "folders", f)
    return this._cloudOrQueue("updateFolder", { id: folderId, patch: stamped }, async () => f)
  }

  async setBoxFolders(boxId: string, folderIds: string[]) {
    const idSet = new Set(folderIds)
    for (const f of this.folders) {
      if (f.box_id === boxId && !idSet.has(f.id)) {
        const stamped = stampUpdatedAt({ box_id: null })
        Object.assign(f, stamped)
        await mirrorPut(this.mirror, "folders", f)
        await this._cloudOrQueue("updateFolder", { id: f.id, patch: stamped }, async () => f)
      }
    }
    for (const fid of folderIds) {
      const f = this.folders.find((x) => x.id === fid)
      if (!f || (f.box_id && f.box_id !== boxId)) continue
      const stamped = stampUpdatedAt({ box_id: boxId })
      Object.assign(f, stamped)
      await mirrorPut(this.mirror, "folders", f)
      await this._cloudOrQueue("updateFolder", { id: fid, patch: stamped }, async () => f)
    }
  }

  findFolderByPackId(packId: string) {
    return findFolderByPackId(this.folders, packId)
  }

  async importVocabPack(pack: any, onProgress?: (n: number) => void) {
    return doImportVocabPack(
      this as unknown as VocabImportStore,
      pack,
      onProgress as ((info: ProgressInfo) => void) | undefined
    )
  }

  async deleteVocabPack(packId: string) {
    return doDeleteVocabPack(this as unknown as VocabImportStore, packId)
  }

  async createCard(data: Partial<Card>) {
    const row = buildCardRecord(data, { user_id: this.sb.userId() })
    await mirrorPut(this.mirror, "cards", row)
    this._patchSrsMeta(row)
    this._cache.prependCard(row.folder_id ?? "", row)
    this._cache.bumpCount(row.folder_id ?? "", 1)
    invalidateDerivedCaches(this, { folderId: row.folder_id })
    const saved = await this._cloudOrQueue("createCard", { row }, async () => row)
    await this._bindPendingUploads(row)
    return saved
  }

  async updateCard(id: string, patch: Partial<Card>) {
    let c = await this._getCardById(id)
    if (!c) return null
    const stamped = stampUpdatedAt(patch)
    Object.assign(c, stamped as Partial<Card>)
    await mirrorPut(this.mirror, "cards", c)
    this._patchSrsMeta(c)
    this._cache.patchCardInLists(id, stamped as Partial<Card>)
    invalidateDerivedCaches(this, { folderId: c.folder_id })
    const saved = await this._cloudOrQueue("updateCard", { id, patch: stamped }, async () => c, {
      optimistic: true
    })
    await this._bindPendingUploads(c)
    return saved
  }

  async deleteCard(id: string) {
    const c = await this._getCardById(id)
    const urls = c ? [c.front_img, c.back_img].filter(Boolean) : []
    if (c) {
      await this._removeCardImages(c)
      await mirrorDelete(this.mirror, "cards", id)
      this._patchSrsMetaRemoval(id)
      this._cache.removeCard(c.folder_id!, id)
      this._cache.bumpCount(c.folder_id!, -1)
      await this._flushSrsMetaPersist()
    }
    invalidateDerivedCaches(this, { folderId: c?.folder_id })
    return this._cloudOrQueue("deleteCard", { id, urls }, async () => true)
  }

  async _removeCardImages(card: Card) {
    for (const url of [card.front_img, card.back_img]) {
      if (url) await this.deleteImage(url)
    }
  }

  /**
   * Загрузить картинку карточки.
   *
   * Офлайн возвращает временный data:-URL, а сам файл кладёт в очередь. Сторона
   * (`front_img`/`back_img`) сохраняется в задании, чтобы после создания
   * карточки её можно было привязать (см. _bindPendingUploads): без привязки
   * настоящая ссылка никогда не доезжала до карточки и data:-URL оставался в
   * облаке навсегда.
   */
  async uploadImage(file: Blob, opts: { side?: string; cardId?: string } = {}) {
    const blob = await resizeImage(file)
    const ext = blob.type === "image/png" ? "png" : "jpg"
    const path = this.sb.userId() + "/" + uuid() + "." + ext
    const side = opts.side === "front_img" || opts.side === "back_img" ? opts.side : undefined
    const queueUpload = async () => {
      const dataUrl = await blobToDataURL(blob)
      await this.queue.enqueue({
        op: "uploadImage",
        payload: { path, blob, contentType: blob.type, side, cardId: opts.cardId }
      })
      this._offline = true
      this._notifySync()
      return dataUrl
    }
    if (!navigator.onLine) return queueUpload()
    try {
      const url = await this.sb.uploadFile("card-images", path, blob, blob.type)
      if (opts.cardId && side) await this._applyUploadedImage(opts.cardId, side, url)
      return url
    } catch (e) {
      if (isNetworkError(e)) return queueUpload()
      throw e
    }
  }

  /**
   * Привязать отложённые загрузки картинок к карточке, которую только что
   * сохранили. Задание при этом переставляется в конец очереди — иначе офлайн
   * загрузка ушла бы в облако раньше самой карточки, и патч ссылки не нашёл бы
   * строку.
   */
  async _bindPendingUploads(card: Card | null | undefined) {
    if (!card?.id || !this.queue.db) return
    let bound = false
    for (const side of ["front_img", "back_img"] as const) {
      const value = card[side]
      if (typeof value === "string" && value.startsWith("data:")) {
        if (await this.queue.bindPendingUpload(side, card.id)) bound = true
      }
    }
    if (!bound) return
    this._notifySync()
    if (navigator.onLine) void this.flushSync()
  }

  async deleteImage(url: string) {
    const marker = "/object/public/card-images/"
    const i = url.indexOf(marker)
    if (i === -1) return
    try {
      await this.sb.deleteFile("card-images", url.slice(i + marker.length))
    } catch (e) {
      console.error("[kar] deleteImage failed:", e)
    }
  }

  async saveSettings(s: Settings) {
    this.settings = s
    await mirrorSetKV(this.mirror, "settings", s)
    if (s.algo === "fsrs") {
      const { preloadFsrs } = await import("../lib/srs.js")
      await preloadFsrs()
    }
    return this._cloudOrQueue("saveSettings", { settings: s }, async () => s)
  }

  async exportJSONFull() {
    const cards = await getAll(this.mirror, "cards")
    const notes = await listNotesFromMirror(this.mirror, { includeConflicts: true })
    return exportJSONPayload(this.folders, cards, this.settings, this.boxes, notes)
  }

  async importJSON(text: string) {
    const data = JSON.parse(text)
    validateImportJSON(data)
    if (!data.folders || !data.cards) throw new Error("Неверный формат файла")
    for (const b of data.boxes || []) {
      if (this.boxes.find((x) => x.id === b.id)) continue
      const row = normalizeBoxRecord(Object.assign({}, b, { user_id: this.sb.userId() }))
      if (row) {
        this.boxes.push(row)
        await mirrorPut(this.mirror, "boxes", row)
        await this._cloudOrQueue("createBox", { row }, async () => row)
      }
    }
    for (const f of data.folders) {
      if (this.folders.find((x) => x.id === f.id)) continue
      const row = normalizeFolderRecord(Object.assign({}, f, { user_id: this.sb.userId() }))
      if (row) {
        this.folders.push(row)
        await mirrorPut(this.mirror, "folders", row)
        await this._cloudOrQueue("createFolder", { row }, async () => row)
      }
    }
    for (const n of data.notes || []) {
      const existing = await getNoteFromMirror(this.mirror, n.id)
      if (existing) continue
      const row = buildNoteRecord(Object.assign({}, n, { user_id: this.sb.userId() }))
      delete (row as { synced_at?: number }).synced_at
      await putNoteInMirror(this.mirror, row)
      await this._cloudOrQueue("createNote", { row }, async () => row)
    }
    const importRows = []
    for (const c of data.cards) {
      if (c.description == null) c.description = ""
      const row = Object.assign({}, c, { user_id: this.sb.userId() })
      // synced_at ставит только сервер (триггер миграции 0011) — в импорте оно
      // лишнее и на схеме без этой колонки просто сломало бы вставку.
      delete row.synced_at
      for (const side of ["front_img", "back_img"]) {
        if (row[side] && row[side].startsWith("data:")) {
          try {
            const blob = await (await fetch(row[side])).blob()
            const ext = blob.type === "image/png" ? "png" : "jpg"
            row[side] = await this.uploadImage(
              new File([blob], "img." + ext, { type: blob.type }),
              { side }
            )
          } catch (e) {
            row[side] = null
          }
        }
      }
      importRows.push(row)
    }
    const BATCH = 100
    for (let i = 0; i < importRows.length; i += BATCH) {
      await mirrorPutMany(this.mirror, "cards", importRows.slice(i, i + BATCH))
    }
    for (const row of importRows) {
      this._patchSrsMeta(row)
      await this._cloudOrQueue("createCard", { row }, async () => row)
      await this._bindPendingUploads(row)
    }
    if (data.settings) await this.saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings))
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    this._cache.clearFolderLists()
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta || [])
    await this._flushSrsMetaPersist()
    invalidateDerivedCaches(this, { allFolders: true })
  }

  // —— Notes ——

  async listNotes(opts: ListNotesOpts = {}) {
    return listNotesFromMirror(this.mirror, opts)
  }

  async searchNoteIds(query: string) {
    return searchNoteIdsInMirror(this.mirror, query)
  }

  async getNote(id: string) {
    return getNoteFromMirror(this.mirror, id)
  }

  async getNoteConflicts(noteId: string) {
    return getNoteConflictsFromMirror(this.mirror, noteId)
  }

  async createNote(data: Partial<Note> = {}) {
    const row = buildNoteRecord(
      { ...data, tags: data.tags ?? extractHashtags(data.body || "") },
      { user_id: this.sb.userId() }
    )
    await putNoteInMirror(this.mirror, row)
    return this._cloudOrQueue("createNote", { row }, async () => row)
  }

  async updateNote(id: string, patch: Partial<Note>) {
    const cur = await getNoteFromMirror(this.mirror, id)
    if (!cur) return null
    const loser = {
      title: cur.title,
      body: cur.body,
      folder_id: cur.folder_id,
      tags: cur.tags,
      created_at: cur.created_at,
      updated_at: cur.updated_at
    }
    let stamped = stampUpdatedAt(patch as Record<string, unknown>) as Partial<Note>
    if (stamped.body != null && stamped.tags == null) {
      stamped = Object.assign({}, stamped, { tags: extractHashtags(stamped.body) })
    }
    const next = mergeNotePatch(cur, stamped)
    await putNoteInMirror(this.mirror, next)
    return this._cloudOrQueue("updateNote", { id, patch: stamped, loser }, async () => next, {
      optimistic: true
    })
  }

  async createNoteConflictCopy(winnerId: string, loser: Partial<Note>) {
    const copy = makeConflictCopy(winnerId, loser)
    copy.user_id = this.sb.userId() || undefined
    await putNoteInMirror(this.mirror, copy)
    return this._cloudOrQueue("createNote", { row: copy }, async () => copy)
  }

  async deleteNote(id: string) {
    const linked = await deleteNoteFromMirror(this.mirror, id)
    for (const c of linked) {
      if (c.id) this._cache.patchCardInLists(c.id, { note_id: null, note_anchor: null })
    }
    this._emitDataChange()
    return this._cloudOrQueue("deleteNote", { id }, async () => true)
  }

  async getNoteCards(noteId: string) {
    const cards = await indexGetAll<Card>(this.mirror, "cards", "note_id", noteId)
    cards.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    return cards
  }

  async linkCardToNote(cardId: string, noteId: string, anchor: string | null = null) {
    return this.updateCard(cardId, { note_id: noteId, note_anchor: anchor })
  }

  async unlinkCardFromNote(cardId: string) {
    return this.updateCard(cardId, { note_id: null, note_anchor: null })
  }
}

/** Ошибка «таблицы review_log ещё нет» (пользователь не применил миграцию 0008). */
function isReviewLogMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /review_log|relation .*does not exist|PGRST205|42P01|42703|could not find the table|schema cache/i.test(
    msg
  )
}
