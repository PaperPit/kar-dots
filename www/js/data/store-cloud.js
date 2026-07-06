// CloudStore — Supabase + локальное зеркало + офлайн-очередь
import { isNetworkError } from './supabase.js';
import {
  openMirrorDB, getAll, mirrorReplaceAll, mirrorPut, mirrorDelete,
  mirrorGetKV, mirrorSetKV, indexGetAll, SyncQueue,
} from './sync-queue.js';
import { DEFAULT_SETTINGS, uuid } from './store-common.js';
import { normalizeFolderRecord, normalizeBoxRecord } from '../lib/folder-icons.js';
import { resizeImage, blobToDataURL } from '../lib/image-utils.js';
import {
  buildFolderRecord, buildCardRecord, buildBoxRecord, exportJSONPayload,
} from './store-contract.js';
import {
  countDueForFolder, countDueBetweenForFolder, countNewForFolder, buildReviewQueue,
} from './srs-query.js';
import {
  findFolderByPackId, importVocabPack as doImportVocabPack,
  deleteVocabPack as doDeleteVocabPack,
} from './store-vocab.js';
import { shuffle } from '../lib/shuffle.js';
import {
  SRS_FIELDS, upsertSrsMeta, removeSrsMeta, removeSrsMetaForFolder, countSrsMetaByFolder,
} from './srs-meta.js';
import { StoreCache } from './store-cache.js';
import { REQUIRED_SCHEMA_VERSION, fetchSchemaVersion } from './schema-version.js';

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
    this._schemaVersion = REQUIRED_SCHEMA_VERSION;
    this._schemaOutdated = false;
    this._deadLetterCount = 0;
  }

  onSyncChange(fn) { this._onSyncChange = fn; }

  async _notifySync() {
    this._deadLetterCount = this.queue.db ? await this.queue.deadLetterCount() : 0;
    if (this._onSyncChange) this._onSyncChange(await this.pendingSync(), this._offline, this._deadLetterCount);
  }

  get offline() { return this._offline; }

  /** Состояние схемы облака для UI-баннера. */
  schemaStatus() {
    return {
      current: this._schemaVersion,
      required: REQUIRED_SCHEMA_VERSION,
      outdated: !!this._schemaOutdated,
    };
  }

  /** Синхронный снимок для баннеров — не требует await. */
  syncHealth() {
    return { offline: this._offline, deadLetterCount: this._deadLetterCount };
  }

  /** Операции, которые не удалось отправить в облако (не сетевая ошибка). */
  async deadLetters() {
    if (!this.queue.db) return [];
    return this.queue.deadLetters();
  }

  /** Вернуть операцию в очередь и сразу попробовать отправить. */
  async retryDeadLetterSync(id) {
    const ok = await this.queue.retryDeadLetter(id);
    if (ok) {
      await this._notifySync();
      if (navigator.onLine && !this._schemaOutdated) await this.flushSync();
    }
    return ok;
  }

  /** Отменить операцию навсегда — она не попадёт в облако. */
  async discardDeadLetterSync(id) {
    await this.queue.discardDeadLetter(id);
    await this._notifySync();
  }

  /** Можно ли читать напрямую из облака (онлайн, не офлайн, схема актуальна). */
  _cloudReadable() {
    return navigator.onLine && !this._offline && !this._schemaOutdated;
  }

  async pendingSync() {
    if (!this.queue.db) return 0;
    return this.queue.size();
  }

  async init() {
    this.mirror = await openMirrorDB();
    await this.queue.init(this.mirror);
    this.queue.onFlush(item => this._executeSyncItem(item));
    this.queue.onDeadLetter(() => this._notifySync());
    window.addEventListener('online', () => this._onOnline());
    await this._loadData();
  }

  async _onOnline() {
    this._offline = false;
    if (this._schemaOutdated) { this._notifySync(); return; }
    await this.flushSync();
    try { await this._fetchFromCloud(); this._notifySync(); } catch (e) { /* mirror */ }
  }

  async flushSync() {
    if (this._schemaOutdated) return { ok: 0, fail: 0 };
    const r = await this.queue.flush();
    if (r.ok > 0) this._notifySync();
    return r;
  }

  /** Один раз при старте: сверяет версию схемы с нужной. */
  async _checkSchema() {
    this._schemaVersion = await fetchSchemaVersion(this.sb);
    this._schemaOutdated = this._schemaVersion < REQUIRED_SCHEMA_VERSION;
    return !this._schemaOutdated;
  }

  async _loadData() {
    if (navigator.onLine) {
      try {
        await this._checkSchema();
        if (this._schemaOutdated) {
          // Схема устарела — работаем из зеркала, пишем в очередь,
          // баннер просит выполнить миграции. Никакого угадывания колонок.
          await this._loadFromMirror({ offline: false });
        } else {
          await this._fetchFromCloud();
          this._offline = false;
          await this.flushSync();
        }
      } catch (e) {
        if (isNetworkError(e)) await this._loadFromMirror();
        else throw e;
      }
    } else {
      await this._loadFromMirror();
    }
    this._notifySync();
  }

  async _fetchFromCloud() {
    const uid = this.sb.userId();
    const [folders, srsMeta, settingsRows, boxesRaw] = await Promise.all([
      this.sb.select('folders', 'select=*&order=created_at.asc'),
      this.sb.select('cards', 'select=' + SRS_FIELDS),
      this.sb.select('settings', 'select=*&user_id=eq.' + uid),
      this.sb.select('boxes', 'select=*&order=created_at.asc'),
    ]);
    this.folders = folders.map(normalizeFolderRecord);
    this.boxes = boxesRaw.map(normalizeBoxRecord).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    await mirrorReplaceAll(this.mirror, 'folders', folders);
    await mirrorReplaceAll(this.mirror, 'boxes', this.boxes);
    this._srsMeta = srsMeta;
    this._cache.clearAll();
    for (const [fid, n] of countSrsMetaByFolder(srsMeta, folders)) {
      this._cache.setCount(fid, n);
    }
    if (settingsRows.length && settingsRows[0].data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsRows[0].data);
    }
    await mirrorSetKV(this.mirror, 'settings', this.settings);
    await mirrorSetKV(this.mirror, 'srs_meta', srsMeta);
    this._offline = false;
  }

  async _loadFromMirror({ offline = true } = {}) {
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
    this._offline = offline;
  }

  async _cloudOrQueue(op, payload, localFn) {
    const result = await localFn();
    if (!navigator.onLine || this._schemaOutdated) {
      if (!navigator.onLine) this._offline = true;
      await this.queue.enqueue({ op, payload });
      this._notifySync();
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

  async _executeSyncItem({ op, payload }) {
    switch (op) {
      // Upsert вместо insert — повтор той же операции (например, после
      // потерянного ответа сети) не падает с конфликтом первичного ключа.
      case 'createFolder':
        await this.sb.upsert('folders', payload.row);
        break;
      case 'updateFolder':
        await this._applyPatchWithLww('folders', payload.id, payload.patch, id => this._reconcileFolder(id));
        break;
      case 'deleteFolder':
        await this.sb.remove('cards', 'folder_id=eq.' + payload.id);
        await this.sb.remove('folders', 'id=eq.' + payload.id);
        break;
      case 'createBox':
        await this.sb.upsert('boxes', payload.row);
        break;
      case 'updateBox':
        await this._applyPatchWithLww('boxes', payload.id, payload.patch, id => this._reconcileBox(id));
        break;
      case 'deleteBox':
        await this.sb.remove('boxes', 'id=eq.' + payload.id);
        break;
      case 'createCard':
        await this.sb.upsert('cards', payload.row);
        break;
      case 'updateCard':
        await this._applyPatchWithLww('cards', payload.id, payload.patch, id => this._reconcileCard(id));
        break;
      case 'deleteCard':
        if (payload.urls) for (const url of payload.urls) await this.deleteImage(url);
        await this.sb.remove('cards', 'id=eq.' + payload.id);
        break;
      case 'saveSettings':
        await this.sb.upsert('settings', { user_id: this.sb.userId(), data: payload.settings, updated_at: Date.now() });
        break;
      case 'uploadImage':
        payload.url = await this.sb.uploadFile('card-images', payload.path, payload.blob, payload.contentType);
        if (payload.cardId && payload.side) {
          // Точечное поле после загрузки картинки — без LWW-guard'а: правка узкая
          // и почти никогда не конфликтует с параллельным редактированием карточки.
          await this.sb.update('cards', 'id=eq.' + payload.cardId, { [payload.side]: payload.url, updated_at: Date.now() });
        }
        break;
      default: throw new Error('Unknown sync op: ' + op);
    }
  }

  /**
   * Применяет patch на сервере только если наша версия не старше текущей
   * (last-write-wins на уровне записи, без лишних round-trip'ов): PostgREST
   * отфильтрует строку по updated_at, и PATCH не заденет её, если сервер уже
   * содержит более новую правку. В этом случае подтягиваем актуальное
   * состояние с сервера, чтобы не разойтись с реальным содержимым облака.
   */
  async _applyPatchWithLww(table, id, patch, reconcile) {
    if (!patch || !Object.keys(patch).length) return;
    const stampedAt = Number(patch.updated_at) || Date.now();
    const filter = 'id=eq.' + id + '&updated_at=lte.' + stampedAt;
    const result = await this.sb.update(table, filter, patch);
    if (Array.isArray(result) && result.length === 0) {
      await reconcile(id);
    }
  }

  async _reconcileFolder(id) {
    try {
      const rows = await this.sb.select('folders', 'id=eq.' + id + '&select=*');
      if (!rows.length) {
        this.folders = this.folders.filter(f => f.id !== id);
        this._cache.deleteFolder(id);
        await mirrorDelete(this.mirror, 'folders', id);
        return;
      }
      const fresh = normalizeFolderRecord(rows[0]);
      const idx = this.folders.findIndex(f => f.id === id);
      if (idx >= 0) this.folders[idx] = fresh; else this.folders.push(fresh);
      await mirrorPut(this.mirror, 'folders', fresh);
    } catch (e) { if (!isNetworkError(e)) throw e; }
  }

  async _reconcileBox(id) {
    try {
      const rows = await this.sb.select('boxes', 'id=eq.' + id + '&select=*');
      if (!rows.length) {
        this.boxes = this.boxes.filter(b => b.id !== id);
        await mirrorDelete(this.mirror, 'boxes', id);
        return;
      }
      const fresh = normalizeBoxRecord(rows[0]);
      const idx = this.boxes.findIndex(b => b.id === id);
      if (idx >= 0) this.boxes[idx] = fresh; else this.boxes.push(fresh);
      await mirrorPut(this.mirror, 'boxes', fresh);
    } catch (e) { if (!isNetworkError(e)) throw e; }
  }

  async _reconcileCard(id) {
    try {
      const rows = await this.sb.select('cards', 'id=eq.' + id + '&select=*');
      if (!rows.length) {
        await mirrorDelete(this.mirror, 'cards', id);
        this._patchSrsMetaRemoval(id);
        this._removeCardFromCacheEverywhere(id);
        return;
      }
      const fresh = rows[0];
      await mirrorPut(this.mirror, 'cards', fresh);
      this._patchSrsMeta(fresh);
      for (const list of this._cache.folderCache.values()) {
        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0) list[idx] = fresh;
      }
    } catch (e) { if (!isNetworkError(e)) throw e; }
  }

  _removeCardFromCacheEverywhere(id) {
    for (const [fid, list] of this._cache.folderCache) {
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) {
        list.splice(idx, 1);
        this._cache.bumpCount(fid, -1);
        return fid;
      }
    }
    return null;
  }

  _patchSrsMeta(card) {
    if (!this._srsMeta) this._srsMeta = [];
    upsertSrsMeta(this._srsMeta, card);
    mirrorSetKV(this.mirror, 'srs_meta', this._srsMeta);
  }

  _patchSrsMetaRemoval(id) {
    if (!this._srsMeta) return;
    this._srsMeta = removeSrsMeta(this._srsMeta, id);
    mirrorSetKV(this.mirror, 'srs_meta', this._srsMeta);
  }

  async getFolderCards(folderId) {
    if (this._cache.folderCache.has(folderId)) return this._cache.folderCache.get(folderId);
    let cards;
    if (this._cloudReadable()) {
      try {
        cards = await this.sb.select('cards', 'folder_id=eq.' + folderId + '&order=created_at.desc');
        for (const c of cards) await mirrorPut(this.mirror, 'cards', c);
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
    if (this._cloudReadable()) {
      try {
        const uid = this.sb.userId();
        const prefix = folderId ? 'folder_id=eq.' + folderId + '&user_id=eq.' + uid : 'user_id=eq.' + uid;
        const dueQ = algo === 'leitner'
          ? prefix + '&box=gt.0&box_due=lte.' + now + '&select=*'
          : algo === 'fsrs'
            ? prefix + '&fsrs_due=not.is.null&fsrs_due=lte.' + now + '&select=*'
            : prefix + '&sm2_due=not.is.null&sm2_due=lte.' + now + '&select=*';
        const newQ = algo === 'leitner'
          ? prefix + '&box=eq.0&select=*&limit=' + newLimit
          : algo === 'fsrs'
            ? prefix + '&fsrs_reps=is.null&fsrs_due=is.null&select=*&limit=' + newLimit
            : prefix + '&sm2_reps=eq.0&sm2_due=is.null&select=*&limit=' + newLimit;
        const [dueCards, newCards] = await Promise.all([
          this.sb.select('cards', dueQ),
          this.sb.select('cards', newQ),
        ]);
        for (const c of dueCards.concat(newCards)) await mirrorPut(this.mirror, 'cards', c);
        return { due: shuffle(dueCards), fresh: shuffle(newCards).slice(0, newLimit) };
      } catch (e) { if (!isNetworkError(e)) throw e; this._offline = true; }
    }

    const cards = [];
    const source = folderId ? await this.getFolderCards(folderId) : (this._srsMeta || []);
    for (const meta of source) {
      let c = meta;
      if (!meta.front) {
        const full = await this._getCardById(meta.id);
        if (full) c = full;
      }
      cards.push(c);
    }
    return buildReviewQueue(cards, algo, newLimit, now);
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
    const stamped = Object.assign({}, patch, { updated_at: Date.now() });
    Object.assign(f, stamped);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id, patch: stamped }, async () => f);
  }

  async deleteFolder(id) {
    const dead = await indexGetAll(this.mirror, 'cards', 'folder_id', id);
    for (const c of dead) await this._removeCardImages(c);
    for (const c of dead) await mirrorDelete(this.mirror, 'cards', c.id);
    await mirrorDelete(this.mirror, 'folders', id);
    this.folders = this.folders.filter(f => f.id !== id);
    this._cache.deleteFolder(id);
    if (this._srsMeta) this._srsMeta = removeSrsMetaForFolder(this._srsMeta, id);
    return this._cloudOrQueue('deleteFolder', { id }, async () => true);
  }

  async createBox(data) {
    const row = buildBoxRecord(data, { user_id: this.sb.userId() });
    this.boxes.push(row);
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    await mirrorPut(this.mirror, 'boxes', row);
    return this._cloudOrQueue('createBox', { row }, async () => row);
  }

  async updateBox(id, patch) {
    const b = this.boxes.find(x => x.id === id);
    if (!b) return null;
    const stamped = Object.assign({}, patch, { updated_at: Date.now() });
    Object.assign(b, stamped);
    await mirrorPut(this.mirror, 'boxes', b);
    return this._cloudOrQueue('updateBox', { id, patch: stamped }, async () => b);
  }

  async deleteBox(id) {
    for (const f of this.folders.filter(x => x.box_id === id)) {
      f.box_id = null;
      await mirrorPut(this.mirror, 'folders', f);
    }
    await mirrorDelete(this.mirror, 'boxes', id);
    this.boxes = this.boxes.filter(b => b.id !== id);
    return this._cloudOrQueue('deleteBox', { id }, async () => true);
  }

  async assignFolderToBox(folderId, boxId) {
    const f = this.folders.find(x => x.id === folderId);
    if (!f) return null;
    if (boxId && !this.boxes.find(b => b.id === boxId)) return null;
    const patch = { box_id: boxId || null, updated_at: Date.now() };
    Object.assign(f, patch);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id: folderId, patch }, async () => f);
  }

  async setBoxFolders(boxId, folderIds) {
    const idSet = new Set(folderIds);
    for (const f of this.folders) {
      if (f.box_id === boxId && !idSet.has(f.id)) {
        const patch = { box_id: null, updated_at: Date.now() };
        Object.assign(f, patch);
        await mirrorPut(this.mirror, 'folders', f);
        await this._cloudOrQueue('updateFolder', { id: f.id, patch }, async () => f);
      }
    }
    for (const fid of folderIds) {
      const f = this.folders.find(x => x.id === fid);
      if (!f || (f.box_id && f.box_id !== boxId)) continue;
      const patch = { box_id: boxId, updated_at: Date.now() };
      Object.assign(f, patch);
      await mirrorPut(this.mirror, 'folders', f);
      await this._cloudOrQueue('updateFolder', { id: fid, patch }, async () => f);
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
    return this._cloudOrQueue('createCard', { row }, async () => row);
  }

  async updateCard(id, patch) {
    let c = await this._getCardById(id);
    if (!c) return null;
    const stamped = Object.assign({}, patch, { updated_at: Date.now() });
    Object.assign(c, stamped);
    await mirrorPut(this.mirror, 'cards', c);
    this._patchSrsMeta(c);
    this._cache.patchCardInLists(id, stamped);
    return this._cloudOrQueue('updateCard', { id, patch: stamped }, async () => c);
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
    }
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
      const row = normalizeBoxRecord(Object.assign({ updated_at: b.created_at || Date.now() }, b, { user_id: this.sb.userId() }));
      this.boxes.push(row);
      await mirrorPut(this.mirror, 'boxes', row);
      await this._cloudOrQueue('createBox', { row }, async () => row);
    }
    for (const f of data.folders) {
      if (this.folders.find(x => x.id === f.id)) continue;
      const row = normalizeFolderRecord(Object.assign({ updated_at: f.created_at || Date.now() }, f, { user_id: this.sb.userId() }));
      this.folders.push(row);
      await mirrorPut(this.mirror, 'folders', row);
      await this._cloudOrQueue('createFolder', { row }, async () => row);
    }
    for (const c of data.cards) {
      if (c.description == null) c.description = '';
      const row = Object.assign({ updated_at: c.created_at || Date.now() }, c, { user_id: this.sb.userId() });
      for (const side of ['front_img', 'back_img']) {
        if (row[side] && row[side].startsWith('data:')) {
          try {
            const blob = await (await fetch(row[side])).blob();
            const ext = blob.type === 'image/png' ? 'png' : 'jpg';
            row[side] = await this.uploadImage(new File([blob], 'img.' + ext, { type: blob.type }));
          } catch (e) { row[side] = null; }
        }
      }
      await mirrorPut(this.mirror, 'cards', row);
      this._patchSrsMeta(row);
      await this._cloudOrQueue('createCard', { row }, async () => row);
    }
    if (data.settings) await this.saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings));
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cache.clearFolderLists();
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta || []);
  }
}
