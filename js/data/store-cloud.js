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
  folderSaveErrorMessage, isMissingFolderIconColumnError, isMissingBoxIdColumnError,
  isMissingBoxesTableError, isMissingBoxIconColumnError, withoutFolderIcon, withoutBoxId,
} from '../lib/folder-errors.js';
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
    this._folderIconCloudUnsupported = false;
    this._boxesCloudUnsupported = false;
    this._boxIdCloudUnsupported = false;
    this._boxIconCloudUnsupported = false;
  }

  onSyncChange(fn) { this._onSyncChange = fn; }

  async _notifySync() {
    if (this._onSyncChange) this._onSyncChange(await this.pendingSync(), this._offline);
  }

  get offline() { return this._offline; }

  async pendingSync() {
    if (!this.queue.db) return 0;
    return this.queue.size();
  }

  async init() {
    this.mirror = await openMirrorDB();
    await this.queue.init(this.mirror);
    await this._loadCloudFlags();
    this.queue.onFlush(item => this._executeSyncItem(item));
    window.addEventListener('online', () => this._onOnline());
    await this._loadData();
  }

  async _onOnline() {
    this._offline = false;
    await this.flushSync();
    try { await this._fetchFromCloud(); this._notifySync(); } catch (e) { /* mirror */ }
  }

  async flushSync() {
    const r = await this.queue.flush();
    if (r.ok > 0) this._notifySync();
    return r;
  }

  async _loadData() {
    if (navigator.onLine) {
      try {
        await this._fetchFromCloud();
        this._offline = false;
        await this.flushSync();
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
      this._fetchBoxesFromCloud(),
    ]);
    this.folders = folders.map(normalizeFolderRecord);
    this.boxes = boxesRaw.map(normalizeBoxRecord).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    if (folders.some(f => Object.prototype.hasOwnProperty.call(f, 'icon'))) {
      this._folderIconCloudUnsupported = false;
      await this._saveCloudFlags();
    }
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

  async _cloudOrQueue(op, payload, localFn) {
    const result = await localFn();
    if (!navigator.onLine) {
      this._offline = true;
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
        await this.sb.upsert('settings', { user_id: this.sb.userId(), data: payload.settings });
        break;
      case 'uploadImage':
        payload.url = await this.sb.uploadFile('card-images', payload.path, payload.blob, payload.contentType);
        if (payload.cardId && payload.side) {
          await this.sb.update('cards', 'id=eq.' + payload.cardId, { [payload.side]: payload.url });
        }
        break;
      default: throw new Error('Unknown sync op: ' + op);
    }
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
    if (navigator.onLine && !this._offline) {
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
    if (navigator.onLine && !this._offline) {
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
    Object.assign(f, patch);
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id, patch }, async () => f);
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
    if (this._boxesCloudUnsupported) return row;
    return this._cloudOrQueue('createBox', { row }, async () => row);
  }

  async updateBox(id, patch) {
    const b = this.boxes.find(x => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    await mirrorPut(this.mirror, 'boxes', b);
    if (this._boxesCloudUnsupported) return b;
    return this._cloudOrQueue('updateBox', { id, patch }, async () => b);
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
    f.box_id = boxId || null;
    await mirrorPut(this.mirror, 'folders', f);
    return this._cloudOrQueue('updateFolder', { id: folderId, patch: { box_id: f.box_id } }, async () => f);
  }

  async setBoxFolders(boxId, folderIds) {
    const idSet = new Set(folderIds);
    for (const f of this.folders) {
      if (f.box_id === boxId && !idSet.has(f.id)) {
        f.box_id = null;
        await mirrorPut(this.mirror, 'folders', f);
        await this._cloudOrQueue('updateFolder', { id: f.id, patch: { box_id: null } }, async () => f);
      }
    }
    for (const fid of folderIds) {
      const f = this.folders.find(x => x.id === fid);
      if (!f || (f.box_id && f.box_id !== boxId)) continue;
      f.box_id = boxId;
      await mirrorPut(this.mirror, 'folders', f);
      await this._cloudOrQueue('updateFolder', { id: fid, patch: { box_id: boxId } }, async () => f);
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
    Object.assign(c, patch);
    await mirrorPut(this.mirror, 'cards', c);
    this._patchSrsMeta(c);
    this._cache.patchCardInLists(id, patch);
    return this._cloudOrQueue('updateCard', { id, patch }, async () => c);
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
