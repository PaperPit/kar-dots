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
  folderSaveErrorMessage, isMissingFolderIconColumnError, isMissingBoxIdColumnError,
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
} from './store-vocab.js';
import { shuffle } from '../lib/shuffle.js';
import {
  REVIEW_CARD_FIELDS, upsertSrsMeta, removeSrsMeta, removeSrsMetaForFolder, countSrsMetaByFolder,
} from './srs-meta.js';
import { StoreCache } from './store-cache.js';
import { buildHomeStats } from './home-stats.js';
import { invalidateDerivedCaches } from './cache-invalidate.js';
import { getCardsByIds, hydrateReviewQueue } from './card-hydrate.js';
import { isYoutubeCard } from '../lib/youtube-import.js';
import {
  CLOUD_SYNC_KEY, SRS_DELTA_SELECT, shouldUseCardsDelta, mergeSrsDelta,
  nextCardsWatermark, stampUpdatedAt,
} from './cloud-delta.js';

export { folderSaveErrorMessage } from '../lib/folder-errors.js';

export class CloudStore {
  constructor(sb) {
    this.kind = 'cloud';
    this.sb = sb;
    this.folders = [];
    this.boxes = [];
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this._cache = new StoreCache();
    this._srsMeta = null;
    this._offline = false;
    this.queue = new SyncQueue();
    this.mirror = null;
    this._onSyncChange = null;
    this._onDataChange = null;
    this._folderIconCloudUnsupported = false;
    this._boxesCloudUnsupported = false;
    this._boxIdCloudUnsupported = false;
    this._boxIconCloudUnsupported = false;
    this._homeStatsCache = null;
    this._homeStatsCacheAlgo = null;
    this._srsMetaPersistTimer = null;
    this._bgSyncTail = Promise.resolve();
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
    this._homeStatsCache = buildHomeStats(this._srsMeta || [], algo);
    this._homeStatsCacheAlgo = algo;
    return this._homeStatsCache;
  }

  onSyncChange(fn) { this._onSyncChange = fn; }
  /** Колбэк перерисовки текущего экрана после фоновой догрузки данных из облака. */
  onDataChange(fn) { this._onDataChange = fn; }
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

  async retryDeadLetter(id) {
    if (!this.queue.db) return false;
    const ok = await this.queue.retryDeadLetter(id);
    if (ok) await this.flushSync();
    await this._notifySync();
    return ok;
  }

  async discardDeadLetter(id) {
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
    await this._loadData();
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
    Promise.resolve().then(async () => {
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
    });
  }

  async _fetchFromCloud() {
    const uid = this.sb.userId();
    const sync = await mirrorGetKV(this.mirror, CLOUD_SYNC_KEY);
    const useDelta = shouldUseCardsDelta(sync, uid);

    const [folders, settingsRows, boxesRaw, cardsPull] = await Promise.all([
      this.sb.select('folders', 'select=*&order=created_at.asc'),
      this.sb.select('settings', 'select=*&user_id=eq.' + uid),
      this._fetchBoxesFromCloud(),
      useDelta ? this._pullCardsDelta(uid, sync.cardsAt) : this._pullCardsFull(),
    ]);

    this.folders = folders.map(normalizeFolderRecord);
    this.boxes = boxesRaw.map(normalizeBoxRecord).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    if (folders.some(f => Object.prototype.hasOwnProperty.call(f, 'icon'))) {
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
    if (settingsRows.length && settingsRows[0].data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsRows[0].data);
    }
    await mirrorSetKV(this.mirror, 'settings', this.settings);
    await mirrorSetKV(this.mirror, 'srs_meta', cardsPull.meta);
    const now = Date.now();
    await mirrorSetKV(this.mirror, CLOUD_SYNC_KEY, {
      userId: uid,
      cardsAt: cardsPull.cardsAt,
      fullAt: cardsPull.full ? now : (sync?.fullAt || now),
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
  async _pullCardsDelta(uid, since) {
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
      const { meta, maxAt } = mergeSrsDelta(base, delta);
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
      const rows = await this.sb.select('boxes', 'select=*&order=created_at.asc');
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
        if (this.mirror) return await getAll(this.mirror, 'boxes');
      } catch (e2) { /* mirror empty */ }
      return [];
    }
  }

  async _loadFromMirror() {
    this.folders = (await getAll(this.mirror, 'folders')).map(normalizeFolderRecord);
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this.boxes = (await getAll(this.mirror, 'boxes')).map(normalizeBoxRecord);
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const settings = await mirrorGetKV(this.mirror, 'settings');
    if (settings) this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    const meta = await mirrorGetKV(this.mirror, 'srs_meta');
    this._srsMeta = meta || [];
    this._cache.clearAll();
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta);
    this._offline = true;
  }

  /**
   * Apply localFn first. Online: wait for cloud unless `optimistic` (UI returns after
   * mirror; network runs in a serialized background chain). Offline / network error → queue.
   */
  async _cloudOrQueue(op, payload, localFn, { optimistic = false } = {}) {
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
  _syncInBackground(op, payload) {
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
    const flags = await mirrorGetKV(this.mirror, 'cloud_flags');
    this._folderIconCloudUnsupported = !!flags?.folderIconCloudUnsupported;
    this._boxesCloudUnsupported = !!flags?.boxesCloudUnsupported;
    this._boxIdCloudUnsupported = !!flags?.boxIdCloudUnsupported;
    this._boxIconCloudUnsupported = !!flags?.boxIconCloudUnsupported;
  }

  async _saveCloudFlags() {
    if (!this.mirror) return;
    await mirrorSetKV(this.mirror, 'cloud_flags', {
      folderIconCloudUnsupported: !!this._folderIconCloudUnsupported,
      boxesCloudUnsupported: !!this._boxesCloudUnsupported,
      boxIdCloudUnsupported: !!this._boxIdCloudUnsupported,
      boxIconCloudUnsupported: !!this._boxIconCloudUnsupported,
    });
  }

  async _cloudInsertFolder(row) {
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

  async _cloudPatchFolder(id, patch) {
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

  async _cloudInsertBox(row) {
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

  async _cloudUpdateBox(id, patch) {
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

  async _cloudDeleteBox(id) {
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

  async _executeSyncItem({ op, payload }) {
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
        await this.sb.upsert('settings', {
          user_id: this.sb.userId(),
          data: payload.settings,
          updated_at: Date.now(),
        });
        break;
      case 'uploadImage':
        payload.url = await this.sb.uploadFile('card-images', payload.path, payload.blob, payload.contentType);
        if (payload.cardId && payload.side) {
          await this.sb.update('cards', 'id=eq.' + payload.cardId, stampUpdatedAt({ [payload.side]: payload.url }));
        }
        break;
      default: throw new Error('Unknown sync op: ' + op);
    }
  }

  _patchSrsMeta(card) {
    if (!this._srsMeta) this._srsMeta = [];
    upsertSrsMeta(this._srsMeta, card);
    this._schedulePersistSrsMeta();
  }

  _patchSrsMetaRemoval(id) {
    if (!this._srsMeta) return;
    this._srsMeta = removeSrsMeta(this._srsMeta, id);
    this._schedulePersistSrsMeta();
  }

  async getFolderCards(folderId) {
    if (this._cache.folderCache.has(folderId)) return this._cache.folderCache.get(folderId);
    let cards;
    if (navigator.onLine && !this._offline) {
      try {
        cards = await this.sb.select('cards', 'folder_id=eq.' + folderId + '&order=created_at.desc');
        await mirrorPutMany(this.mirror, 'cards', cards);
      } catch (e) {
        if (isNetworkError(e)) {
          this._offline = true;
          cards = await indexGetAll(this.mirror, 'cards', 'folder_id', folderId);
        } else throw e;
      }
    } else {
      cards = await indexGetAll(this.mirror, 'cards', 'folder_id', folderId);
    }
    cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    this._cache.folderCache.set(folderId, cards);
    return cards;
  }

  async countCards(folderId) {
    return this._cache.countCards(folderId);
  }

  async countDue(folderId, algo) {
    algo = algo || this.settings.algo;
    return countDueForFolder(this._srsMeta ?? [], folderId, algo, Date.now());
  }

  async countDueBetween(folderId, algo, from, to) {
    algo = algo || this.settings.algo;
    return countDueBetweenForFolder(this._srsMeta ?? [], folderId, algo, from, to);
  }

  async countNew(folderId, algo) {
    algo = algo || this.settings.algo;
    return countNewForFolder(this._srsMeta ?? [], folderId, algo);
  }

  async getReviewCards(folderId, algo, newLimit, now) {
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

  async getCramCards(folderId, limit) {
    const source = filterByFolder(this._srsMeta || [], folderId);
    const picked = shuffle(source);
    const slice = limit > 0 ? picked.slice(0, limit) : picked;
    const byId = await getCardsByIds(this.mirror, this._cache, slice.map(c => c.id));
    return hydrateReviewQueue(slice, byId);
  }

  async scanFolderFronts(folderId, { youtubeOnly = false } = {}) {
    if (navigator.onLine && !this._offline) {
      try {
        const rows = await this.sb.select('cards', 'folder_id=eq.' + folderId + '&select=front,description');
        return rows
          .filter(c => !youtubeOnly || isYoutubeCard(c))
          .filter(c => c.front)
          .map(c => ({ front: c.front }));
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        this._offline = true;
      }
    }
    const cards = await indexGetAll(this.mirror, 'cards', 'folder_id', folderId);
    const mini = [];
    for (const c of cards) {
      if (youtubeOnly && !isYoutubeCard(c)) continue;
      if (c.front) mini.push({ front: c.front });
    }
    return mini;
  }

  async _getCardById(id) {
    for (const list of this._cache.folderCache.values()) {
      const c = list.find(x => x.id === id);
      if (c) return c;
    }
    return new Promise((resolve, reject) => {
      const req = this.mirror.transaction('cards').objectStore('cards').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async createFolder(data) {
    const row = buildFolderRecord(data, { user_id: this.sb.userId() });
    this.folders.push(row);
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cache.setCount(row.id, 0);
    await mirrorPut(this.mirror, 'folders', row);
    return this._cloudOrQueue('createFolder', { row }, async () => row);
  }

  async updateFolder(id, patch) {
    const f = this.folders.find(x => x.id === id);
    if (!f) return null;
    const stamped = stampUpdatedAt(patch);
    Object.assign(f, stamped);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id, patch: stamped }, async () => f);
  }

  async deleteFolder(id) {
    const dead = await indexGetAll(this.mirror, 'cards', 'folder_id', id);
    await Promise.all(dead.map(c => this._removeCardImages(c)));
    await mirrorDeleteMany(this.mirror, 'cards', dead.map(c => c.id));
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

  async createBox(data) {
    const row = buildBoxRecord(data, { user_id: this.sb.userId() });
    this.boxes.push(row);
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    await mirrorPut(this.mirror, 'boxes', row);
    if (this._boxesCloudUnsupported) return row;
    return this._cloudOrQueue('createBox', { row }, async () => row);
  }

  async updateBox(id, patch) {
    const b = this.boxes.find(x => x.id === id);
    if (!b) return null;
    const stamped = stampUpdatedAt(patch);
    Object.assign(b, stamped);
    await mirrorPut(this.mirror, 'boxes', b);
    if (this._boxesCloudUnsupported) return b;
    return this._cloudOrQueue('updateBox', { id, patch: stamped }, async () => b);
  }

  async deleteBox(id) {
    for (const f of this.folders.filter(x => x.box_id === id)) {
      f.box_id = null;
      await mirrorPut(this.mirror, 'folders', f);
    }
    await mirrorDelete(this.mirror, 'boxes', id);
    this.boxes = this.boxes.filter(b => b.id !== id);
    if (this._boxesCloudUnsupported) return true;
    return this._cloudOrQueue('deleteBox', { id }, async () => true);
  }

  async assignFolderToBox(folderId, boxId) {
    const f = this.folders.find(x => x.id === folderId);
    if (!f) return null;
    if (boxId && !this.boxes.find(b => b.id === boxId)) return null;
    const stamped = stampUpdatedAt({ box_id: boxId || null });
    Object.assign(f, stamped);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id: folderId, patch: stamped }, async () => f);
  }

  async setBoxFolders(boxId, folderIds) {
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

  findFolderByPackId(packId) {
    return findFolderByPackId(this.folders, packId);
  }

  async importVocabPack(pack, onProgress) {
    return doImportVocabPack(this, pack, onProgress);
  }

  async deleteVocabPack(packId) {
    return doDeleteVocabPack(this, packId);
  }

  async createCard(data) {
    const row = buildCardRecord(data, { user_id: this.sb.userId() });
    await mirrorPut(this.mirror, 'cards', row);
    this._patchSrsMeta(row);
    this._cache.prependCard(row.folder_id, row);
    this._cache.bumpCount(row.folder_id, 1);
    invalidateDerivedCaches(this, { folderId: row.folder_id });
    return this._cloudOrQueue('createCard', { row }, async () => row);
  }

  async updateCard(id, patch) {
    let c = await this._getCardById(id);
    if (!c) return null;
    const stamped = stampUpdatedAt(patch);
    Object.assign(c, stamped);
    await mirrorPut(this.mirror, 'cards', c);
    this._patchSrsMeta(c);
    this._cache.patchCardInLists(id, stamped);
    invalidateDerivedCaches(this, { folderId: c.folder_id });
    return this._cloudOrQueue('updateCard', { id, patch: stamped }, async () => c, { optimistic: true });
  }

  async deleteCard(id) {
    const c = await this._getCardById(id);
    const urls = c ? [c.front_img, c.back_img].filter(Boolean) : [];
    if (c) {
      await this._removeCardImages(c);
      await mirrorDelete(this.mirror, 'cards', id);
      this._patchSrsMetaRemoval(id);
      this._cache.removeCard(c.folder_id, id);
      this._cache.bumpCount(c.folder_id, -1);
      await this._flushSrsMetaPersist();
    }
    invalidateDerivedCaches(this, { folderId: c?.folder_id });
    return this._cloudOrQueue('deleteCard', { id, urls }, async () => true);
  }

  async _removeCardImages(card) {
    for (const url of [card.front_img, card.back_img]) {
      if (url) await this.deleteImage(url);
    }
  }

  async uploadImage(file) {
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

  async deleteImage(url) {
    const marker = '/object/public/card-images/';
    const i = url.indexOf(marker);
    if (i === -1) return;
    try { await this.sb.deleteFile('card-images', url.slice(i + marker.length)); } catch (e) {}
  }

  async saveSettings(s) {
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

  async importJSON(text) {
    const data = JSON.parse(text);
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла');
    for (const b of (data.boxes || [])) {
      if (this.boxes.find(x => x.id === b.id)) continue;
      const row = normalizeBoxRecord(Object.assign({}, b, { user_id: this.sb.userId() }));
      this.boxes.push(row);
      await mirrorPut(this.mirror, 'boxes', row);
      await this._cloudOrQueue('createBox', { row }, async () => row);
    }
    for (const f of data.folders) {
      if (this.folders.find(x => x.id === f.id)) continue;
      const row = normalizeFolderRecord(Object.assign({}, f, { user_id: this.sb.userId() }));
      this.folders.push(row);
      await mirrorPut(this.mirror, 'folders', row);
      await this._cloudOrQueue('createFolder', { row }, async () => row);
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
