// LocalStore — IndexedDB, карточки подгружаются по папкам
import { indexGetAll } from './sync-queue.js';
import { DEFAULT_SETTINGS } from './store-common.js';
import { normalizeFolderRecord, normalizeBoxRecord } from '../lib/folder-icons.js';
import { resizeImage, blobToDataURL } from '../lib/image-utils.js';
import {
  buildFolderRecord, buildCardRecord, buildBoxRecord, exportJSONPayload,
} from './store-contract.js';
import {
  buildReviewQueue, filterByFolder,
  countDueForFolder, countDueBetweenForFolder, countNewForFolder,
} from './srs-query.js';
import { buildHomeStats } from './home-stats.js';
import { invalidateDerivedCaches } from './cache-invalidate.js';
import { getCardsByIds, hydrateReviewQueue } from './card-hydrate.js';
import {
  toSrsMeta, upsertSrsMeta, removeSrsMeta, removeSrsMetaForFolder,
} from './srs-meta.js';
import { isYoutubeCard } from '../lib/youtube-import.js';
import { shuffle } from '../lib/shuffle.js';
import {
  findFolderByPackId, importVocabPack as doImportVocabPack,
  deleteVocabPack as doDeleteVocabPack,
} from './store-vocab.js';
import { StoreCache } from './store-cache.js';

export { DEFAULT_SETTINGS, uuid } from './store-common.js';

const IDB_NAME = 'kartochki';
const IDB_VERSION = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cards')) {
        const cards = db.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('folder_id', 'folder_id', { unique: false });
      } else if (e.oldVersion < 2) {
        const cards = req.transaction.objectStore('cards');
        if (!cards.indexNames.contains('folder_id')) cards.createIndex('folder_id', 'folder_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('boxes')) db.createObjectStore('boxes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

function idbGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function forEachCard(db, folderId, fn) {
  return new Promise((resolve, reject) => {
    const txObj = db.transaction('cards', 'readonly');
    const store = txObj.objectStore('cards');
    const source = folderId
      ? store.index('folder_id').openCursor(IDBKeyRange.only(folderId))
      : store.openCursor();
    source.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { fn(cursor.value); cursor.continue(); }
      else resolve();
    };
    source.onerror = () => reject(source.error);
  });
}

function cardCount(db, folderId) {
  return new Promise((resolve, reject) => {
    const txObj = db.transaction('cards', 'readonly');
    const store = txObj.objectStore('cards');
    const source = folderId
      ? store.index('folder_id').openCursor(IDBKeyRange.only(folderId))
      : store.openCursor();
    let n = 0;
    source.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { n++; cursor.continue(); }
      else resolve(n);
    };
    source.onerror = () => reject(source.error);
  });
}

function kvGet(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function kvSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', 'readwrite');
    t.objectStore('kv').put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

const SRS_META_KEY = 'srs_meta';
const SRS_META_PERSIST_MS = 200;

export class LocalStore {
  constructor() {
    this.kind = 'local';
    this.folders = [];
    this.boxes = [];
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this._cache = new StoreCache();
    this._srsMeta = [];
    this._homeStatsCache = null;
    this._homeStatsCacheAlgo = null;
    this._srsMetaPersistTimer = null;
  }

  _patchSrsMeta(card) {
    upsertSrsMeta(this._srsMeta, card);
    this._schedulePersistSrsMeta();
  }

  _patchSrsMetaRemoval(id) {
    this._srsMeta = removeSrsMeta(this._srsMeta, id);
    this._schedulePersistSrsMeta();
  }

  _schedulePersistSrsMeta() {
    if (this._srsMetaPersistTimer) clearTimeout(this._srsMetaPersistTimer);
    this._srsMetaPersistTimer = setTimeout(() => {
      this._srsMetaPersistTimer = null;
      this._persistSrsMeta();
    }, SRS_META_PERSIST_MS);
  }

  async _persistSrsMeta() {
    if (!this.db) return;
    await kvSet(this.db, SRS_META_KEY, this._srsMeta);
  }

  async _rebuildSrsMetaFromCards() {
    this._srsMeta = [];
    await forEachCard(this.db, null, c => {
      this._srsMeta.push(toSrsMeta(c));
    });
    this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta);
    await this._persistSrsMeta();
  }

  _invalidateHomeStats() {
    this._homeStatsCache = null;
    this._homeStatsCacheAlgo = null;
  }

  async getHomeStats() {
    const algo = this.settings.algo;
    if (this._homeStatsCache && this._homeStatsCacheAlgo === algo) {
      return this._homeStatsCache;
    }
    this._homeStatsCache = buildHomeStats(this._srsMeta, algo);
    this._homeStatsCacheAlgo = algo;
    return this._homeStatsCache;
  }

  async init() {
    this.db = await openDB();
    this.folders = (await idbGetAll(this.db, 'folders')).map(normalizeFolderRecord);
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this.boxes = (await idbGetAll(this.db, 'boxes')).map(normalizeBoxRecord);
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const raw = localStorage.getItem('kar_settings_local');
    if (raw) try { this.settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)); } catch (e) {}
    await this._loadSrsMeta();
    if (this.settings.algo === 'fsrs') {
      const { preloadFsrs } = await import('../lib/srs.js');
      preloadFsrs();
    }
  }

  async _loadSrsMeta() {
    const cached = await kvGet(this.db, SRS_META_KEY);
    if (Array.isArray(cached)) {
      this._srsMeta = cached;
      this._cache.rebuildCountsFromSrsMeta(this.folders, this._srsMeta);
      const n = await cardCount(this.db, null);
      if (n === this._srsMeta.length) return;
    }
    await this._rebuildSrsMetaFromCards();
  }

  async getFolderCards(folderId) {
    if (this._cache.folderCache.has(folderId)) return this._cache.folderCache.get(folderId);
    const cards = await indexGetAll(this.db, 'cards', 'folder_id', folderId);
    cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    cards.forEach(c => { if (c.description == null) c.description = ''; });
    this._cache.folderCache.set(folderId, cards);
    return cards;
  }

  async countCards(folderId) {
    if (folderId) {
      if (this._cache.hasCount(folderId)) return this._cache.getCount(folderId);
      return cardCount(this.db, folderId);
    }
    return this._cache.countCards(null);
  }

  async countDue(folderId, algo) {
    algo = algo || this.settings.algo;
    return countDueForFolder(this._srsMeta, folderId, algo, Date.now());
  }

  async countDueBetween(folderId, algo, from, to) {
    algo = algo || this.settings.algo;
    return countDueBetweenForFolder(this._srsMeta, folderId, algo, from, to);
  }

  async countNew(folderId, algo) {
    algo = algo || this.settings.algo;
    return countNewForFolder(this._srsMeta, folderId, algo);
  }

  async getReviewCards(folderId, algo, newLimit, now) {
    algo = algo || this.settings.algo;
    now = now || Date.now();
    const source = filterByFolder(this._srsMeta, folderId);
    const { due, fresh } = buildReviewQueue(source, algo, newLimit, now);
    const ids = [...due.map(c => c.id), ...fresh.map(c => c.id)];
    const byId = await getCardsByIds(this.db, this._cache, ids);
    return {
      due: hydrateReviewQueue(due, byId),
      fresh: hydrateReviewQueue(fresh, byId),
    };
  }

  /** Cram: shuffle ids из slim meta, hydrate только выбранных (с limit). */
  async getCramCards(folderId, limit) {
    const source = filterByFolder(this._srsMeta, folderId);
    const picked = shuffle(source);
    const slice = limit > 0 ? picked.slice(0, limit) : picked;
    const byId = await getCardsByIds(this.db, this._cache, slice.map(c => c.id));
    return hydrateReviewQueue(slice, byId);
  }

  async _getCardById(id) {
    for (const list of this._cache.folderCache.values()) {
      const c = list.find(x => x.id === id);
      if (c) return c;
    }
    return new Promise((resolve, reject) => {
      const req = this.db.transaction('cards').objectStore('cards').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async scanFolderFronts(folderId, { youtubeOnly = false } = {}) {
    const mini = [];
    await forEachCard(this.db, folderId, c => {
      if (youtubeOnly && !isYoutubeCard(c)) return;
      if (c.front) mini.push({ front: c.front });
    });
    return mini;
  }

  async createFolder(data) {
    const f = buildFolderRecord(data);
    await tx(this.db, 'folders', 'readwrite', s => s.put(f));
    this.folders.push(f);
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cache.setCount(f.id, 0);
    return f;
  }

  async updateFolder(id, patch) {
    const f = this.folders.find(x => x.id === id);
    if (!f) return null;
    Object.assign(f, patch);
    await tx(this.db, 'folders', 'readwrite', s => s.put(f));
    return f;
  }

  async deleteFolder(id) {
    const dead = await indexGetAll(this.db, 'cards', 'folder_id', id);
    await tx(this.db, 'cards', 'readwrite', s => { dead.forEach(c => s.delete(c.id)); });
    await tx(this.db, 'folders', 'readwrite', s => s.delete(id));
    this.folders = this.folders.filter(f => f.id !== id);
    this._cache.deleteFolder(id);
    this._srsMeta = removeSrsMetaForFolder(this._srsMeta, id);
    await this._persistSrsMeta();
    invalidateDerivedCaches(this, { folderId: id });
  }

  async createBox(data) {
    const b = buildBoxRecord(data);
    await tx(this.db, 'boxes', 'readwrite', s => s.put(b));
    this.boxes.push(b);
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    return b;
  }

  async updateBox(id, patch) {
    const b = this.boxes.find(x => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    await tx(this.db, 'boxes', 'readwrite', s => s.put(b));
    return b;
  }

  async deleteBox(id) {
    const folders = this.folders.filter(f => f.box_id === id);
    for (const f of folders) {
      f.box_id = null;
      await tx(this.db, 'folders', 'readwrite', s => s.put(f));
    }
    await tx(this.db, 'boxes', 'readwrite', s => s.delete(id));
    this.boxes = this.boxes.filter(b => b.id !== id);
  }

  async assignFolderToBox(folderId, boxId) {
    const f = this.folders.find(x => x.id === folderId);
    if (!f) return null;
    if (boxId && !this.boxes.find(b => b.id === boxId)) return null;
    f.box_id = boxId || null;
    await tx(this.db, 'folders', 'readwrite', s => s.put(f));
    return f;
  }

  async setBoxFolders(boxId, folderIds) {
    const idSet = new Set(folderIds);
    for (const f of this.folders) {
      if (f.box_id === boxId && !idSet.has(f.id)) {
        f.box_id = null;
        await tx(this.db, 'folders', 'readwrite', s => s.put(f));
      }
    }
    for (const fid of folderIds) {
      const f = this.folders.find(x => x.id === fid);
      if (!f || (f.box_id && f.box_id !== boxId)) continue;
      f.box_id = boxId;
      await tx(this.db, 'folders', 'readwrite', s => s.put(f));
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
    const c = buildCardRecord(data);
    await tx(this.db, 'cards', 'readwrite', s => s.put(c));
    this._cache.prependCard(c.folder_id, c);
    this._cache.bumpCount(c.folder_id, 1);
    this._patchSrsMeta(c);
    invalidateDerivedCaches(this, { folderId: c.folder_id });
    return c;
  }

  async updateCard(id, patch) {
    const c = await this._getCardById(id);
    if (!c) return null;
    Object.assign(c, patch);
    await tx(this.db, 'cards', 'readwrite', s => s.put(c));
    this._cache.patchCardInLists(id, patch);
    this._patchSrsMeta(c);
    invalidateDerivedCaches(this, { folderId: c.folder_id });
    return c;
  }

  async deleteCard(id) {
    let folderId = null;
    for (const [fid, list] of this._cache.folderCache) {
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) { folderId = fid; list.splice(idx, 1); break; }
    }
    if (!folderId) {
      folderId = this._srsMeta.find(m => m.id === id)?.folder_id || null;
    }
    await tx(this.db, 'cards', 'readwrite', s => s.delete(id));
    if (folderId) this._cache.bumpCount(folderId, -1);
    this._patchSrsMetaRemoval(id);
    invalidateDerivedCaches(this, { folderId });
  }

  async uploadImage(file) {
    const blob = await resizeImage(file);
    return blobToDataURL(blob);
  }

  async deleteImage() {}

  async saveSettings(s) {
    this.settings = s;
    localStorage.setItem('kar_settings_local', JSON.stringify(s));
    if (s.algo === 'fsrs') {
      const { preloadFsrs } = await import('../lib/srs.js');
      await preloadFsrs();
    }
  }

  async exportJSONFull() {
    const cards = await idbGetAll(this.db, 'cards');
    return exportJSONPayload(this.folders, cards, this.settings, this.boxes);
  }

  async importJSON(text) {
    const data = JSON.parse(text);
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла');
    for (const b of (data.boxes || [])) {
      if (!this.boxes.find(x => x.id === b.id)) {
        const row = normalizeBoxRecord(b);
        await tx(this.db, 'boxes', 'readwrite', s => s.put(row));
        this.boxes.push(row);
      }
    }
    for (const f of data.folders) {
      if (!this.folders.find(x => x.id === f.id)) {
        const row = normalizeFolderRecord(f);
        await tx(this.db, 'folders', 'readwrite', s => s.put(row));
        this.folders.push(row);
      }
    }
    for (const c of data.cards) {
      if (c.description == null) c.description = '';
      await tx(this.db, 'cards', 'readwrite', s => s.put(c));
    }
    if (data.settings) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
      localStorage.setItem('kar_settings_local', JSON.stringify(this.settings));
    }
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cache.clearFolderLists();
    await this._rebuildSrsMetaFromCards();
    invalidateDerivedCaches(this, { allFolders: true });
  }

  get offline() { return false; }
  async pendingSync() { return 0; }
  async deadLetterCount() { return 0; }
  async deadLetters() { return []; }
  async retryDeadLetter() { return false; }
  async discardDeadLetter() { return false; }
  async flushSync() { return { ok: 0, fail: 0 }; }
}
