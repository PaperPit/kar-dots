// CloudStore — Supabase + локальное зеркало + офлайн-очередь
import { isNetworkError } from './supabase.js';
import {
  openMirrorDB, getAll, mirrorReplaceAll, mirrorPut, mirrorPutMany, mirrorDelete, mirrorDeleteMany,
  mirrorGetKV, mirrorSetKV, indexGetAll, SyncQueue,
} from './sync-queue.js';
import { DEFAULT_SETTINGS, uuid } from './store-common.js';
import { normalizeFolderRecord, normalizeBoxRecord } from '../lib/folder-icons.js';
import { resizeImage, blobToDataURL } from '../lib/image-utils.js';
import {
  isMissingFolderIconColumnError, isMissingBoxIdColumnError,
  isMissingBoxesTableError, isMissingBoxIconColumnError, withoutFolderIcon, withoutBoxId,
} from '../lib/folder-errors.js';
import {
  buildFolderRecord, buildCardRecord, buildBoxRecord, exportJSONPayload,
} from './store-contract.js';
import {
  countDueForFolder, countDueBetweenForFolder, countNewForFolder, buildReviewQueue, filterByFolder,
} from './srs-query.js';
import {
  findFolderByPackId, importVocabPack as doImportVocabPack,
  deleteVocabPack as doDeleteVocabPack,
  type VocabImportStore,
} from './store-vocab.js';
import { shuffle } from '../lib/shuffle.js';
import {
  REVIEW_CARD_FIELDS, upsertSrsMeta, removeSrsMeta, removeSrsMetaForFolder, countSrsMetaByFolder,
} from './srs-meta.js';
import { StoreCache } from './store-cache.js';
import { buildHomeStats, type HomeStats } from './home-stats.js';
import { invalidateDerivedCaches } from './cache-invalidate.js';
import { getCardsByIds, hydrateReviewQueue } from './card-hydrate.js';
import { isYoutubeCard } from '../lib/youtube-import.js';
import type { Card, Folder, Box, Settings } from './types.js';
import type { SrsMeta } from './srs-meta.js';
import type { Algo, SrsRow } from '../lib/srs.js';
import type { ProgressInfo } from './store-vocab.js';
import type { MiniSupabase } from './supabase.js';
import {
  CLOUD_SYNC_KEY, SRS_DELTA_SELECT, shouldUseCardsDelta, mergeSrsDelta,
  nextCardsWatermark, stampUpdatedAt,
} from './cloud-delta.js';
import {
  setActivityCloudSync, applyRemoteActivity, loadActivity,
  type ActivityData,
} from '../lib/activity.js';
import {
  setReviewLogCloudSync,
  lastReviewTs,
  applyRemoteReviews,
  initReviewLog,
  type ReviewLogEntry,
} from '../lib/review-log.js';

export { folderSaveErrorMessage } from '../lib/folder-errors.js';

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
  _homeStatsCache: HomeStats | null
  _homeStatsCacheAlgo: Algo | null
  _srsMetaPersistTimer: ReturnType<typeof setTimeout> | null
  _activityPushTimer: ReturnType<typeof setTimeout> | null
  _bgSyncTail: Promise<void>
  /** Промис текущей фоновой синхронизации с облаком (если идёт). */
  _cloudSyncPromise: Promise<void> | null

  constructor(sb: MiniSupabase) {
    this.kind = 'cloud';
    this.sb = sb;
    this.folders = [];
    this.boxes = [];
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this._cache = new StoreCache();
    this._srsMeta = null;
    this._offline = false;
    this.queue = new SyncQueue();
    this._onSyncChange = null;
    this._onDataChange = null;
    this._folderIconCloudUnsupported = false;
    this._reviewLogCloudUnsupported = false;
    this._boxesCloudUnsupported = false;
    this._boxIdCloudUnsupported = false;
    this._boxIconCloudUnsupported = false;
    this._homeStatsCache = null;
    this._homeStatsCacheAlgo = null;
    this._srsMetaPersistTimer = null;
    this._activityPushTimer = null;
    this._bgSyncTail = Promise.resolve();
    this._cloudSyncPromise = null;
  }

  _invalidateHomeStats() {
    this._homeStatsCache = null;
    this._homeStatsCacheAlgo = null;
  }

  _schedulePersistSrsMeta() {
    if (this._srsMetaPersistTimer) clearTimeout(this._srsMetaPersistTimer);
    this._srsMetaPersistTimer = setTimeout(() => {
      this._srsMetaPersistTimer = null;
      this._persistSrsMeta();
    }, 200);
  }

  async _persistSrsMeta() {
    if (!this.mirror || !this._srsMeta) return;
    await mirrorSetKV(this.mirror, 'srs_meta', this._srsMeta);
  }

  async _flushSrsMetaPersist() {
    if (this._srsMetaPersistTimer) {
      clearTimeout(this._srsMetaPersistTimer);
      this._srsMetaPersistTimer = null;
    }
    await this._persistSrsMeta();
  }

  async getHomeStats() {
    const algo = this.settings.algo;
    if (this._homeStatsCache && this._homeStatsCacheAlgo === algo) {
      return this._homeStatsCache;
    }
    this._homeStatsCache = buildHomeStats(this._srsMeta || [], algo as Algo);
    this._homeStatsCacheAlgo = algo as Algo;
    return this._homeStatsCache;
  }

  onSyncChange(fn: (state: SyncState) => void) { this._onSyncChange = fn; }
  /** Колбэк перерисовки текущего экрана после фоновой догрузки данных из облака. */
  onDataChange(fn: () => void) { this._onDataChange = fn; }
  _emitDataChange() {
    if (!this._onDataChange) return;
    try { this._onDataChange(); } catch (e) { console.error('onDataChange failed:', e); }
  }

  async _notifySync() {
    if (!this._onSyncChange) return;
    this._onSyncChange({
      pending: await this.pendingSync(),
      failed: await this.deadLetterCount(),
      offline: this._offline,
    });
  }

  get offline() { return this._offline; }

  async pendingSync() {
    if (!this.queue.db) return 0;
    return this.queue.size();
  }

  async deadLetterCount() {
    if (!this.queue.db) return 0;
    return this.queue.deadLetterCount();
  }

  async deadLetters() {
    if (!this.queue.db) return [];
    return this.queue.deadLetters();
  }

  async retryDeadLetter(id: number) {
    if (!this.queue.db) return false;
    const ok = await this.queue.retryDeadLetter(id);
    if (ok) await this.flushSync();
    await this._notifySync();
    return ok;
  }

  async discardDeadLetter(id: number) {
    if (!this.queue.db) return false;
    const ok = await this.queue.discardDeadLetter(id);
    await this._notifySync();
    return ok;
  }

  async init() {
    this.mirror = await openMirrorDB();
    await this.queue.init(this.mirror);
    await this._loadCloudFlags();
    this.queue.onFlush(item => this._executeSyncItem(item));
    this.queue.onDeadLetter(() => this._notifySync());
    window.addEventListener('online', () => this._onOnline());
    this._bindActivityCloudSync();
    this._bindReviewLogCloudSync();
    void initReviewLog();
    await this._loadData();
  }

  /** Активность (календарь/серия) пишется в settings.data и едет между устройствами. */
  _bindActivityCloudSync() {
    setActivityCloudSync((data) => {
      if (this._activityPushTimer) clearTimeout(this._activityPushTimer);
      this._activityPushTimer = setTimeout(() => {
        this._activityPushTimer = null;
        void this._pushActivityToCloud(data);
      }, 1000);
    });
  }

  /** Журнал повторений: push/remove через очередь синка (best-effort, не блокирует оценку). */
  _bindReviewLogCloudSync() {
    setReviewLogCloudSync({
      push: (entry) => { void this.queue.enqueue({ op: 'logReview', payload: entry }).then(() => this.flushSync()); },
      remove: (id) => { void this.queue.enqueue({ op: 'removeReview', payload: { id } }).then(() => this.flushSync()); },
    });
  }

  /** Подтянуть журнал повторений из облака (вызывать на экране статистики). */
  async syncReviewLogFromCloud(): Promise<number> {
    if (this._reviewLogCloudUnsupported || !this.sb.userId()) return 0;
    try {
      const since = await lastReviewTs();
      const rows = await this.sb.select<ReviewLogEntry>(
        'review_log',
        'select=*&ts=gt.' + since + '&order=ts.asc&limit=5000'
      );
      return await applyRemoteReviews(rows);
    } catch (e) {
      if (isReviewLogMissing(e)) { this._reviewLogCloudUnsupported = true; await this._saveCloudFlags(); return 0; }
      if (isNetworkError(e)) return 0;
      console.warn('review-log pull', e);
      return 0;
    }
  }

  /** Все slim-SRS строки карточек — для прогноза нагрузки на экране статистики. */
  getAllSrsRows(): SrsRow[] {
    return (this._srsMeta || []) as unknown as SrsRow[];
  }

  async _pushActivityToCloud(data: ActivityData) {
    try {
      this.settings.activity = data;
      await this.saveSettings(this.settings);
    } catch (e) {
      console.warn('activity cloud push', e);
    }
  }

  /** Слить activity из settings с локальной; если на устройстве больше — отправить в облако. */
  async _ingestRemoteActivity() {
    const remote = this.settings.activity;
    const changed = await applyRemoteActivity(remote);
    const local = loadActivity();
    if (JSON.stringify(local) !== JSON.stringify(remote || { days: {} })) {
      await this._pushActivityToCloud(local);
    }
    return changed;
  }

  /** Явно слить/отправить статистику дня (Знаю/Не знаю/серия). Вызывать после входа и с кнопки «Синхронизировать». */
  async syncActivityNow() {
    if (this._activityPushTimer) {
      clearTimeout(this._activityPushTimer);
      this._activityPushTimer = null;
    }
    const changed = await this._ingestRemoteActivity();
    if (changed) this._emitDataChange();
    return changed;
  }

  async _onOnline() {
    this._offline = false;
    await this.flushSync();
    try { await this._fetchFromCloud(); this._notifySync(); this._emitDataChange(); } catch (e) { /* mirror */ }
  }

  async flushSync() {
    const r = await this.queue.flush();
    if (r.ok > 0 || r.fail > 0) this._notifySync();
    return r;
  }

  async _loadData() {
    // Сначала быстрый локальный рендер из зеркала IndexedDB — мгновенно и работает офлайн.
    await this._loadFromMirror();
    this._offline = !navigator.onLine;
    // Не блокируем старт сетью: показываем данные из зеркала сразу (даже если оно пустое),
    // а облако вместе с обновлением токена догружаем в фоне. При недоступном Supabase
    // старт не висит — данные подтянутся и экран обновится, когда бэкенд ответит.
    if (navigator.onLine) this._syncFromCloudInBackground();

    this._notifySync();
    if (this.settings.algo === 'fsrs') {
      const { preloadFsrs } = await import('../lib/srs.js');
      preloadFsrs();
    }
  }

  /** Догружает данные из облака в фоне и обновляет UI, не блокируя первый экран. */
  _syncFromCloudInBackground() {
    const run = (async () => {
      try {
        await this._fetchFromCloud();
        this._offline = false;
        await this.flushSync();
        this._notifySync();
        this._emitDataChange();
      } catch (e) {
        if (isNetworkError(e)) { this._offline = true; this._notifySync(); }
        else console.error('Фоновая синхронизация не удалась:', e);
      }
    })();
    this._cloudSyncPromise = run.finally(() => {
      if (this._cloudSyncPromise === run) this._cloudSyncPromise = null;
    });
  }

  /**
   * Дождаться текущей (или только что запущенной) синхронизации с облаком.
   * Нужно при первом входе, когда зеркало пустое — иначе home рисуется без папок.
   */
  async whenCloudReady() {
    if (this._cloudSyncPromise) {
      await this._cloudSyncPromise;
      return;
    }
    if (!navigator.onLine) return;
    this._syncFromCloudInBackground();
    if (this._cloudSyncPromise) await this._cloudSyncPromise;
  }

  async _fetchFromCloud() {
    const uid = this.sb.userId();
    if (!uid) throw new Error('Нет активной сессии');
    const sync = (await mirrorGetKV(this.mirror, CLOUD_SYNC_KEY)) as { fullAt?: number; cardsAt?: number } | null;
    const useDelta = shouldUseCardsDelta(sync, uid);

    const [folders, settingsRows, boxesRaw, cardsPull] = await Promise.all([
      this.sb.select<Folder>('folders', 'select=*&order=created_at.asc'),
      this.sb.select<{ data?: Settings }>('settings', 'select=*&user_id=eq.' + uid),
      this._fetchBoxesFromCloud(),
      useDelta ? this._pullCardsDelta(uid, sync?.cardsAt ?? Date.now()) : this._pullCardsFull(),
    ]);

    this.folders = folders.map(normalizeFolderRecord).filter((f): f is Folder => !!f);
    this.boxes = boxesRaw.map(normalizeBoxRecord).filter((b): b is Box => !!b)
      .sort((a: Box, b: Box) => (a.created_at || 0) - (b.created_at || 0));
    if (folders.some((f: Folder) => Object.prototype.hasOwnProperty.call(f, 'icon'))) {
      this._folderIconCloudUnsupported = false;
      await this._saveCloudFlags();
    }
    await mirrorReplaceAll(this.mirror, 'folders', folders);
    await mirrorReplaceAll(this.mirror, 'boxes', this.boxes);
    this._srsMeta = cardsPull.meta;
    this._cache.clearAll();
    for (const [fid, n] of countSrsMetaByFolder(cardsPull.meta, folders)) {
      this._cache.setCount(fid, n);
    }
    invalidateDerivedCaches(this);
    const settingsRow = settingsRows[0];
    if (settingsRow?.data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsRow.data);
    }
    await mirrorSetKV(this.mirror, 'settings', this.settings);
    await this._ingestRemoteActivity();
    await mirrorSetKV(this.mirror, 'srs_meta', cardsPull.meta);
    const now = Date.now();
    await mirrorSetKV(this.mirror, CLOUD_SYNC_KEY, {
      userId: uid,
      cardsAt: cardsPull.cardsAt,
      fullAt: cardsPull.full ? now : (sync?.fullAt ?? now),
    });
    this._offline = false;
  }

  async _pullCardsFull() {
    const rows = await this.sb.select('cards', 'select=' + SRS_DELTA_SELECT);
    const { meta, maxAt } = mergeSrsDelta([], rows);
    return { meta, cardsAt: nextCardsWatermark(0, maxAt), full: true };
  }

  /**
   * Pull only cards with updated_at > since, merge into mirror srs_meta.
   * Falls back to full when remote count disagrees (deletes) or query fails.
   */
  async _pullCardsDelta(uid: string, since: number) {
    try {
      const base = this._srsMeta
        || (await mirrorGetKV(this.mirror, 'srs_meta'))
        || [];
      const [delta, remoteCount] = await Promise.all([
        this.sb.select(
          'cards',
          'user_id=eq.' + uid + '&updated_at=gt.' + since + '&select=' + SRS_DELTA_SELECT,
        ),
        this.sb.count('cards', 'user_id=eq.' + uid),
      ]);
      const { meta, maxAt } = mergeSrsDelta(base as SrsMeta[] | null | undefined, delta);
      if (remoteCount !== meta.length) return this._pullCardsFull();
      return {
        meta,
        cardsAt: nextCardsWatermark(since, maxAt),
        full: false,
      };
    } catch (e) {
      if (isNetworkError(e)) throw e;
      return this._pullCardsFull();
    }
  }

  async _fetchBoxesFromCloud() {
    try {
      const rows = await this.sb.select<Box>('boxes', 'select=*&order=created_at.asc');
      if (this._boxesCloudUnsupported) {
        this._boxesCloudUnsupported = false;
        await this._saveCloudFlags();
      }
      return rows;
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true;
        await this._saveCloudFlags();
      }
      try {
        if (this.mirror) return await getAll<Box>(this.mirror, 'boxes');
      } catch (e2) { /* mirror empty */ }
      return [];
    }
  }

  async _loadFromMirror() {
    this.folders = ((await getAll(this.mirror, 'folders')) as (Folder | null | undefined)[]).map(normalizeFolderRecord).filter((f): f is Folder => !!f);
    this.folders.sort((a: Folder, b: Folder) => (a.created_at || 0) - (b.created_at || 0));
    this.boxes = ((await getAll(this.mirror, 'boxes')) as (Box | null | undefined)[]).map(normalizeBoxRecord).filter((b): b is Box => !!b);
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const settings = await mirrorGetKV(this.mirror, 'settings');
    if (settings) this.settings = Object.assign({}, DEFAULT_SETTINGS, settings as Partial<Settings>);
    await this._ingestRemoteActivity();
    const meta = await mirrorGetKV(this.mirror, 'srs_meta');
    this._srsMeta = (meta as SrsMeta[] | null) || [];
    this._cache.clearAll();
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta);
    this._offline = true;
  }

  /**
   * Apply localFn first. Online: wait for cloud unless `optimistic` (UI returns after
   * mirror; network runs in a serialized background chain). Offline / network error → queue.
   */
  async _cloudOrQueue(op: string, payload: unknown, localFn: () => Promise<unknown>, { optimistic = false }: { optimistic?: boolean } = {}) {
    const result = await localFn();
    if (!navigator.onLine) {
      this._offline = true;
      await this.queue.enqueue({ op, payload });
      this._notifySync();
      return result;
    }
    if (optimistic) {
      this._syncInBackground(op, payload);
      return result;
    }
    try {
      await this._executeSyncItem({ op, payload });
      this._offline = false;
      return result;
    } catch (e) {
      if (isNetworkError(e)) {
        this._offline = true;
        await this.queue.enqueue({ op, payload });
        this._notifySync();
        return result;
      }
      throw e;
    }
  }

  /** Serialized fire-and-forget cloud op; on failure falls back to SyncQueue. */
  _syncInBackground(op: string, payload: unknown) {
    const run = async () => {
      try {
        await this._executeSyncItem({ op, payload });
        this._offline = false;
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true;
          await this.queue.enqueue({ op, payload });
          this._notifySync();
          return;
        }
        await this.queue.enqueue({ op, payload });
        this._notifySync();
        try { await this.flushSync(); } catch (_) { /* dead-letter / still pending */ }
      }
    };
    this._bgSyncTail = this._bgSyncTail.then(run, run);
  }

  async _loadCloudFlags() {
    if (!this.mirror) return;
    const flags = (await mirrorGetKV(this.mirror, 'cloud_flags')) as { folderIconCloudUnsupported?: boolean; boxesCloudUnsupported?: boolean; boxIdCloudUnsupported?: boolean; boxIconCloudUnsupported?: boolean; reviewLogCloudUnsupported?: boolean } | null;
    this._folderIconCloudUnsupported = !!flags?.folderIconCloudUnsupported;
    this._boxesCloudUnsupported = !!flags?.boxesCloudUnsupported;
    this._boxIdCloudUnsupported = !!flags?.boxIdCloudUnsupported;
    this._boxIconCloudUnsupported = !!flags?.boxIconCloudUnsupported;
    this._reviewLogCloudUnsupported = !!flags?.reviewLogCloudUnsupported;
  }

  async _saveCloudFlags() {
    if (!this.mirror) return;
    await mirrorSetKV(this.mirror, 'cloud_flags', {
      folderIconCloudUnsupported: !!this._folderIconCloudUnsupported,
      boxesCloudUnsupported: !!this._boxesCloudUnsupported,
      boxIdCloudUnsupported: !!this._boxIdCloudUnsupported,
      boxIconCloudUnsupported: !!this._boxIconCloudUnsupported,
      reviewLogCloudUnsupported: !!this._reviewLogCloudUnsupported,
    });
  }

  async _cloudInsertFolder(row: Folder) {
    let payload = row;
    if (this._folderIconCloudUnsupported) payload = withoutFolderIcon(row);
    try {
      await this.sb.insert('folders', payload);
    } catch (e) {
      if (!this._folderIconCloudUnsupported && isMissingFolderIconColumnError(e) && row && 'icon' in row) {
        this._folderIconCloudUnsupported = true;
        await this._saveCloudFlags();
        await this.sb.insert('folders', withoutFolderIcon(row));
        return;
      }
      throw e;
    }
  }

  async _cloudPatchFolder(id: string, patch: Partial<Folder>) {
    let payload = Object.assign({}, patch);
    if (this._folderIconCloudUnsupported) payload = withoutFolderIcon(payload);
    if (this._boxIdCloudUnsupported) payload = withoutBoxId(payload);
    if (!Object.keys(payload).length) return;
    try {
      await this.sb.update('folders', 'id=eq.' + id, payload);
    } catch (e) {
      if (!this._folderIconCloudUnsupported && isMissingFolderIconColumnError(e) && patch && 'icon' in patch) {
        this._folderIconCloudUnsupported = true;
        await this._saveCloudFlags();
        await this._cloudPatchFolder(id, withoutFolderIcon(patch));
        return;
      }
      if (!this._boxIdCloudUnsupported && isMissingBoxIdColumnError(e) && patch && 'box_id' in patch) {
        this._boxIdCloudUnsupported = true;
        await this._saveCloudFlags();
        await this._cloudPatchFolder(id, withoutBoxId(patch));
        return;
      }
      throw e;
    }
  }

  async _cloudInsertBox(row: Box) {
    if (this._boxesCloudUnsupported) return;
    let payload = row;
    if (this._boxIconCloudUnsupported) payload = withoutFolderIcon(row);
    try {
      await this.sb.insert('boxes', payload);
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true;
        await this._saveCloudFlags();
        return;
      }
      if (!this._boxIconCloudUnsupported && isMissingBoxIconColumnError(e) && row && 'icon' in row) {
        this._boxIconCloudUnsupported = true;
        await this._saveCloudFlags();
        await this._cloudInsertBox(withoutFolderIcon(row));
        return;
      }
      throw e;
    }
  }

  async _cloudUpdateBox(id: string, patch: Partial<Box>) {
    if (this._boxesCloudUnsupported) return;
    let payload = Object.assign({}, patch);
    if (this._boxIconCloudUnsupported) payload = withoutFolderIcon(payload);
    if (!Object.keys(payload).length) return;
    try {
      await this.sb.update('boxes', 'id=eq.' + id, payload);
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true;
        await this._saveCloudFlags();
        return;
      }
      if (!this._boxIconCloudUnsupported && isMissingBoxIconColumnError(e) && patch && 'icon' in patch) {
        this._boxIconCloudUnsupported = true;
        await this._saveCloudFlags();
        await this._cloudUpdateBox(id, withoutFolderIcon(patch));
        return;
      }
      throw e;
    }
  }

  async _cloudDeleteBox(id: string) {
    if (this._boxesCloudUnsupported) return;
    try {
      await this.sb.remove('boxes', 'id=eq.' + id);
    } catch (e) {
      if (isMissingBoxesTableError(e)) {
        this._boxesCloudUnsupported = true;
        await this._saveCloudFlags();
        return;
      }
      throw e;
    }
  }

  async _executeSyncItem({ op, payload }: { op: string; payload: any }) {
    switch (op) {
      case 'createFolder': await this._cloudInsertFolder(payload.row); break;
      case 'updateFolder': await this._cloudPatchFolder(payload.id, payload.patch); break;
      case 'deleteFolder':
        await this.sb.remove('cards', 'folder_id=eq.' + payload.id);
        await this.sb.remove('folders', 'id=eq.' + payload.id);
        break;
      case 'createBox': await this._cloudInsertBox(payload.row); break;
      case 'updateBox': await this._cloudUpdateBox(payload.id, payload.patch); break;
      case 'deleteBox': await this._cloudDeleteBox(payload.id); break;
      case 'createCard': await this.sb.insert('cards', payload.row); break;
      case 'updateCard': await this.sb.update('cards', 'id=eq.' + payload.id, payload.patch); break;
      case 'deleteCard':
        if (payload.urls) for (const url of payload.urls) await this.deleteImage(url);
        await this.sb.remove('cards', 'id=eq.' + payload.id);
        break;
      case 'saveSettings':
        await this._cloudSaveSettings(payload.settings);
        break;
      case 'uploadImage':
        payload.url = await this.sb.uploadFile('card-images', payload.path, payload.blob, payload.contentType);
        if (payload.cardId && payload.side) {
          await this.sb.update('cards', 'id=eq.' + payload.cardId, stampUpdatedAt({ [payload.side]: payload.url }));
        }
        break;
      case 'logReview': await this._cloudLogReview(payload as ReviewLogEntry); break;
      case 'removeReview': await this._cloudRemoveReview(payload.id); break;
      default: throw new Error('Unknown sync op: ' + op);
    }
  }

  async _cloudLogReview(entry: ReviewLogEntry) {
    if (this._reviewLogCloudUnsupported) return;
    const uid = this.sb.userId();
    if (!uid) throw new Error('Нет активной сессии — войдите снова');
    try {
      await this.sb.upsert('review_log', Object.assign({ user_id: uid }, entry), { onConflict: 'id' });
    } catch (e) {
      if (isReviewLogMissing(e)) { this._reviewLogCloudUnsupported = true; await this._saveCloudFlags(); return; }
      throw e;
    }
  }

  async _cloudRemoveReview(id: string) {
    if (this._reviewLogCloudUnsupported) return;
    try {
      await this.sb.remove('review_log', 'id=eq.' + id);
    } catch (e) {
      if (isReviewLogMissing(e)) { this._reviewLogCloudUnsupported = true; await this._saveCloudFlags(); return; }
      throw e;
    }
  }

  async _cloudSaveSettings(settings: unknown) {
    const uid = this.sb.userId();
    if (!uid) throw new Error('Нет активной сессии — войдите снова');
    const row = {
      user_id: uid,
      data: settings,
      updated_at: Date.now(),
    };
    const push = async () => {
      // on_conflict обязателен для upsert под RLS; иначе PostgREST часто делает INSERT и падает.
      try {
        await this.sb.upsert('settings', row, { onConflict: 'user_id' });
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/row-level security|42501/i.test(msg)) throw e;
      }
      // Fallback: UPDATE, при пустом ответе — INSERT (надёжнее при глюках upsert+RLS).
      try {
        await this.sb.update('settings', 'user_id=eq.' + uid, {
          data: settings,
          updated_at: row.updated_at,
        });
      } catch (e) {
        /* try insert below */
      }
      try {
        await this.sb.insert('settings', row);
      } catch (e2) {
        // Строка уже есть — повторный update
        await this.sb.update('settings', 'user_id=eq.' + uid, {
          data: settings,
          updated_at: Date.now(),
        });
      }
    };
    try {
      await push();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/row-level security|42501|JWT|session|401|403/i.test(msg)) {
        try {
          await this.sb.refresh();
          await push();
          return;
        } catch (e2) {
          throw e2 instanceof Error ? e2 : e;
        }
      }
      throw e;
    }
  }

  _patchSrsMeta(card: Card) {
    if (!this._srsMeta) this._srsMeta = [];
    upsertSrsMeta(this._srsMeta, card);
    this._schedulePersistSrsMeta();
  }

  _patchSrsMetaRemoval(id: string) {
    if (!this._srsMeta) return;
    this._srsMeta = removeSrsMeta(this._srsMeta, id);
    this._schedulePersistSrsMeta();
  }

  async getFolderCards(folderId: string) {
    if (this._cache.folderCache.has(folderId)) return this._cache.folderCache.get(folderId);
    let cards;
    if (navigator.onLine && !this._offline) {
      try {
        cards = await this.sb.select<Card>('cards', 'folder_id=eq.' + folderId + '&order=created_at.desc');
        await mirrorPutMany(this.mirror, 'cards', cards);
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true;
          cards = await indexGetAll<Card>(this.mirror, 'cards', 'folder_id', folderId ?? '');
        } else throw e;
      }
    } else {
      cards = await indexGetAll<Card>(this.mirror, 'cards', 'folder_id', folderId);
    }
    cards.sort((a: Card, b: Card) => (b.created_at || 0) - (a.created_at || 0));
    this._cache.folderCache.set(folderId, cards);
    return cards;
  }

  async countCards(folderId?: string | null) {
    return this._cache.countCards(folderId ?? undefined);
  }

  async countDue(folderId: string | null, algo: Algo) {
    algo = algo || this.settings.algo;
    return countDueForFolder(this._srsMeta ?? [], folderId, algo, Date.now());
  }

  async countDueBetween(folderId: string | null, algo: Algo, from: number, to: number) {
    algo = algo || this.settings.algo;
    return countDueBetweenForFolder(this._srsMeta ?? [], folderId, algo, from, to);
  }

  async countNew(folderId: string | null, algo: Algo) {
    algo = algo || this.settings.algo;
    return countNewForFolder(this._srsMeta ?? [], folderId, algo);
  }

  async getReviewCards(folderId: string | null, algo: Algo, newLimit: number, now: number) {
    algo = algo || this.settings.algo;
    now = now || Date.now();
    if (navigator.onLine && !this._offline) {
      try {
        const uid = this.sb.userId();
        const prefix = folderId ? 'folder_id=eq.' + folderId + '&user_id=eq.' + uid : 'user_id=eq.' + uid;
        const sel = '&select=' + REVIEW_CARD_FIELDS;
        const dueQ = algo === 'leitner'
          ? prefix + '&box=gt.0&box_due=lte.' + now + sel
          : algo === 'fsrs'
            ? prefix + '&fsrs_due=not.is.null&fsrs_due=lte.' + now + sel
            : prefix + '&sm2_due=not.is.null&sm2_due=lte.' + now + sel;
        const newQ = algo === 'leitner'
          ? prefix + '&box=eq.0' + sel + '&limit=' + newLimit
          : algo === 'fsrs'
            ? prefix + '&fsrs_reps=is.null&fsrs_due=is.null' + sel + '&limit=' + newLimit
            : prefix + '&sm2_reps=eq.0&sm2_due=is.null' + sel + '&limit=' + newLimit;
        const [dueCards, newCards] = await Promise.all([
          this.sb.select('cards', dueQ),
          this.sb.select('cards', newQ),
        ]);
        await mirrorPutMany(this.mirror, 'cards', dueCards.concat(newCards));
        return { due: shuffle(dueCards), fresh: shuffle(newCards).slice(0, newLimit) };
      } catch (e) { if (!isNetworkError(e)) throw e; this._offline = true; }
    }

    const source = filterByFolder(this._srsMeta || [], folderId);
    const { due, fresh } = buildReviewQueue(source, algo, newLimit, now);
    const ids = [...due.map(c => c.id), ...fresh.map(c => c.id)];
    const byId = await getCardsByIds(this.mirror, this._cache, ids);
    return {
      due: hydrateReviewQueue(due, byId),
      fresh: hydrateReviewQueue(fresh, byId),
    };
  }

  async getCramCards(folderId: string | null, limit: number) {
    const source = filterByFolder(this._srsMeta || [], folderId);
    const picked = shuffle(source);
    const slice = limit > 0 ? picked.slice(0, limit) : picked;
    const byId = await getCardsByIds(this.mirror, this._cache, slice.map(c => c.id));
    return hydrateReviewQueue(slice, byId);
  }

  async scanFolderFronts(folderId: string | null, { youtubeOnly = false }: { youtubeOnly?: boolean } = {}) {
    if (navigator.onLine && !this._offline) {
      try {
        const rows = (await this.sb.select('cards', 'folder_id=eq.' + folderId + '&select=front,description')) as Card[];
        return rows
          .filter(c => !youtubeOnly || isYoutubeCard(c))
          .filter(c => c.front)
          .map(c => ({ front: c.front }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this._offline = true;
      }
    }
    const cards = (await indexGetAll(this.mirror, 'cards', 'folder_id', folderId ?? '')) as Card[];
    const mini = [];
    for (const c of cards) {
      if (youtubeOnly && !isYoutubeCard(c)) continue;
      if (c.front) mini.push({ front: c.front });
    }
    return mini;
  }

  async _getCardById(id: string): Promise<Card | null> {
    for (const list of this._cache.folderCache.values()) {
      const c = list.find(x => x.id === id);
      if (c) return c;
    }
    return new Promise((resolve, reject) => {
      const req = this.mirror.transaction('cards').objectStore('cards').get(id);
      req.onsuccess = () => resolve((req.result as Card | null) || null);
      req.onerror = () => reject(req.error);
    });
  }

  async createFolder(data: Partial<Folder>) {
    const row = buildFolderRecord(data, { user_id: this.sb.userId() });
    this.folders.push(row);
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cache.setCount(row.id, 0);
    await mirrorPut(this.mirror, 'folders', row);
    return this._cloudOrQueue('createFolder', { row }, async () => row);
  }

  async updateFolder(id: string, patch: Partial<Folder>) {
    const f = this.folders.find(x => x.id === id);
    if (!f) return null;
    const stamped = stampUpdatedAt(patch);
    Object.assign(f, stamped);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id, patch: stamped }, async () => f);
  }

  async deleteFolder(id: string) {
    const dead = (await indexGetAll(this.mirror, 'cards', 'folder_id', id)) as Card[];
    await Promise.all(dead.map(c => this._removeCardImages(c)));
    await mirrorDeleteMany(this.mirror, 'cards', dead.map(c => c.id!));
    await mirrorDelete(this.mirror, 'folders', id);
    this.folders = this.folders.filter(f => f.id !== id);
    this._cache.deleteFolder(id);
    if (this._srsMeta) {
      this._srsMeta = removeSrsMetaForFolder(this._srsMeta, id);
      await this._flushSrsMetaPersist();
    }
    invalidateDerivedCaches(this, { folderId: id });
    return this._cloudOrQueue('deleteFolder', { id }, async () => true);
  }

  async createBox(data: Partial<Box>) {
    const row = buildBoxRecord(data, { user_id: this.sb.userId() });
    this.boxes.push(row);
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    await mirrorPut(this.mirror, 'boxes', row);
    if (this._boxesCloudUnsupported) return row;
    return this._cloudOrQueue('createBox', { row }, async () => row);
  }

  async updateBox(id: string, patch: Partial<Box>) {
    const b = this.boxes.find(x => x.id === id);
    if (!b) return null;
    const stamped = stampUpdatedAt(patch);
    Object.assign(b, stamped);
    await mirrorPut(this.mirror, 'boxes', b);
    if (this._boxesCloudUnsupported) return b;
    return this._cloudOrQueue('updateBox', { id, patch: stamped }, async () => b);
  }

  async deleteBox(id: string) {
    for (const f of this.folders.filter(x => x.box_id === id)) {
      f.box_id = undefined;
      await mirrorPut(this.mirror, 'folders', f);
    }
    await mirrorDelete(this.mirror, 'boxes', id);
    this.boxes = this.boxes.filter(b => b.id !== id);
    if (this._boxesCloudUnsupported) return true;
    return this._cloudOrQueue('deleteBox', { id }, async () => true);
  }

  async assignFolderToBox(folderId: string, boxId?: string | null) {
    const f = this.folders.find(x => x.id === folderId);
    if (!f) return null;
    if (boxId && !this.boxes.find(b => b.id === boxId)) return null;
    const stamped = stampUpdatedAt({ box_id: boxId || null });
    Object.assign(f, stamped);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id: folderId, patch: stamped }, async () => f);
  }

  async setBoxFolders(boxId: string, folderIds: string[]) {
    const idSet = new Set(folderIds);
    for (const f of this.folders) {
      if (f.box_id === boxId && !idSet.has(f.id)) {
        const stamped = stampUpdatedAt({ box_id: null });
        Object.assign(f, stamped);
        await mirrorPut(this.mirror, 'folders', f);
        await this._cloudOrQueue('updateFolder', { id: f.id, patch: stamped }, async () => f);
      }
    }
    for (const fid of folderIds) {
      const f = this.folders.find(x => x.id === fid);
      if (!f || (f.box_id && f.box_id !== boxId)) continue;
      const stamped = stampUpdatedAt({ box_id: boxId });
      Object.assign(f, stamped);
      await mirrorPut(this.mirror, 'folders', f);
      await this._cloudOrQueue('updateFolder', { id: fid, patch: stamped }, async () => f);
    }
  }

  findFolderByPackId(packId: string) {
    return findFolderByPackId(this.folders, packId);
  }

  async importVocabPack(pack: any, onProgress?: (n: number) => void) {
    return doImportVocabPack(this as unknown as VocabImportStore, pack, onProgress as ((info: ProgressInfo) => void) | undefined);
  }

  async deleteVocabPack(packId: string) {
    return doDeleteVocabPack(this as unknown as VocabImportStore, packId);
  }

  async createCard(data: Partial<Card>) {
    const row = buildCardRecord(data, { user_id: this.sb.userId() });
    await mirrorPut(this.mirror, 'cards', row);
    this._patchSrsMeta(row);
    this._cache.prependCard(row.folder_id ?? "", row);
    this._cache.bumpCount(row.folder_id ?? "", 1);
    invalidateDerivedCaches(this, { folderId: row.folder_id });
    return this._cloudOrQueue('createCard', { row }, async () => row);
  }

  async updateCard(id: string, patch: Partial<Card>) {
    let c = await this._getCardById(id);
    if (!c) return null;
    const stamped = stampUpdatedAt(patch);
    Object.assign(c, stamped as Partial<Card>);
    await mirrorPut(this.mirror, 'cards', c);
    this._patchSrsMeta(c);
    this._cache.patchCardInLists(id, stamped as Partial<Card>);
    invalidateDerivedCaches(this, { folderId: c.folder_id });
    return this._cloudOrQueue('updateCard', { id, patch: stamped }, async () => c, { optimistic: true });
  }

  async deleteCard(id: string) {
    const c = await this._getCardById(id);
    const urls = c ? [c.front_img, c.back_img].filter(Boolean) : [];
    if (c) {
      await this._removeCardImages(c);
      await mirrorDelete(this.mirror, 'cards', id);
      this._patchSrsMetaRemoval(id);
      this._cache.removeCard(c.folder_id!, id);
      this._cache.bumpCount(c.folder_id!, -1);
      await this._flushSrsMetaPersist();
    }
    invalidateDerivedCaches(this, { folderId: c?.folder_id });
    return this._cloudOrQueue('deleteCard', { id, urls }, async () => true);
  }

  async _removeCardImages(card: Card) {
    for (const url of [card.front_img, card.back_img]) {
      if (url) await this.deleteImage(url);
    }
  }

  async uploadImage(file: Blob) {
    const blob = await resizeImage(file);
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = this.sb.userId() + '/' + uuid() + '.' + ext;
    if (!navigator.onLine) {
      const dataUrl = await blobToDataURL(blob);
      await this.queue.enqueue({ op: 'uploadImage', payload: { path, blob, contentType: blob.type } });
      this._offline = true;
      this._notifySync();
      return dataUrl;
    }
    try {
      return await this.sb.uploadFile('card-images', path, blob, blob.type);
    } catch (e) {
      if (isNetworkError(e)) {
        const dataUrl = await blobToDataURL(blob);
        await this.queue.enqueue({ op: 'uploadImage', payload: { path, blob, contentType: blob.type } });
        this._offline = true;
        this._notifySync();
        return dataUrl;
      }
      throw e;
    }
  }

  async deleteImage(url: string) {
    const marker = '/object/public/card-images/';
    const i = url.indexOf(marker);
    if (i === -1) return;
    try { await this.sb.deleteFile('card-images', url.slice(i + marker.length)); } catch (e) {}
  }

  async saveSettings(s: Settings) {
    this.settings = s;
    await mirrorSetKV(this.mirror, 'settings', s);
    if (s.algo === 'fsrs') {
      const { preloadFsrs } = await import('../lib/srs.js');
      await preloadFsrs();
    }
    return this._cloudOrQueue('saveSettings', { settings: s }, async () => s);
  }

  async exportJSONFull() {
    const cards = await getAll(this.mirror, 'cards');
    return exportJSONPayload(this.folders, cards, this.settings, this.boxes);
  }

  async importJSON(text: string) {
    const data = JSON.parse(text);
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла');
    for (const b of (data.boxes || [])) {
      if (this.boxes.find(x => x.id === b.id)) continue;
      const row = normalizeBoxRecord(Object.assign({}, b, { user_id: this.sb.userId() }));
      if (row) {
        this.boxes.push(row);
        await mirrorPut(this.mirror, 'boxes', row);
        await this._cloudOrQueue('createBox', { row }, async () => row);
      }
    }
    for (const f of data.folders) {
      if (this.folders.find(x => x.id === f.id)) continue;
      const row = normalizeFolderRecord(Object.assign({}, f, { user_id: this.sb.userId() }));
      if (row) {
        this.folders.push(row);
        await mirrorPut(this.mirror, 'folders', row);
        await this._cloudOrQueue('createFolder', { row }, async () => row);
      }
    }
    const importRows = [];
    for (const c of data.cards) {
      if (c.description == null) c.description = '';
      const row = Object.assign({}, c, { user_id: this.sb.userId() });
      for (const side of ['front_img', 'back_img']) {
        if (row[side] && row[side].startsWith('data:')) {
          try {
            const blob = await (await fetch(row[side])).blob();
            const ext = blob.type === 'image/png' ? 'png' : 'jpg';
            row[side] = await this.uploadImage(new File([blob], 'img.' + ext, { type: blob.type }));
          } catch (e) { row[side] = null; }
        }
      }
      importRows.push(row);
    }
    const BATCH = 100;
    for (let i = 0; i < importRows.length; i += BATCH) {
      await mirrorPutMany(this.mirror, 'cards', importRows.slice(i, i + BATCH));
    }
    for (const row of importRows) {
      this._patchSrsMeta(row);
      await this._cloudOrQueue('createCard', { row }, async () => row);
    }
    if (data.settings) await this.saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings));
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cache.clearFolderLists();
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta || []);
    await this._flushSrsMetaPersist();
    invalidateDerivedCaches(this, { allFolders: true });
  }
}

/** Ошибка «таблицы review_log ещё нет» (пользователь не применил миграцию 0008). */
function isReviewLogMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /review_log|relation .*does not exist|PGRST205|42P01|42703|could not find the table|schema cache/i.test(msg);
}
