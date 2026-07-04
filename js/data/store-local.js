// ============================================================
// КАР-точки — слой данных
// LocalStore — IndexedDB, карточки подгружаются по папкам
// CloudStore — Supabase + локальное зеркало + очередь офлайн
// ============================================================

import * as SRS from '../lib/srs.js';
import { indexGetAll } from './sync-queue.js';
import { DEFAULT_SETTINGS, uuid } from './store-common.js';

export { DEFAULT_SETTINGS, uuid } from './store-common.js';

function resizeImage(file, maxSide) {
  maxSide = maxSide || 1024;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Не удалось обработать картинку')),
        hasAlpha ? 'image/png' : 'image/jpeg',
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Файл не похож на картинку')); };
    img.src = url;
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

const IDB_NAME = 'kartochki';
const IDB_VERSION = 2;

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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class LocalStore {
  constructor() {
    this.kind = 'local';
    this.folders = [];
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this._folderCache = new Map();
    this._cardCounts = new Map();
  }

  async init() {
    this.db = await openDB();
    this.folders = await idbGetAll(this.db, 'folders');
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    const raw = localStorage.getItem('kar_settings_local');
    if (raw) try { this.settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)); } catch (e) {}
    await this._refreshCounts();
  }

  async _refreshCounts() {
    this._cardCounts.clear();
    for (const f of this.folders) {
      this._cardCounts.set(f.id, await cardCount(this.db, f.id));
    }
  }

  async getFolderCards(folderId) {
    if (this._folderCache.has(folderId)) return this._folderCache.get(folderId);
    const cards = await indexGetAll(this.db, 'cards', 'folder_id', folderId);
    cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    cards.forEach(c => { if (c.description == null) c.description = ''; });
    this._folderCache.set(folderId, cards);
    return cards;
  }

  async countCards(folderId) {
    if (folderId) return this._cardCounts.get(folderId) || cardCount(this.db, folderId);
    let n = 0;
    for (const c of this._cardCounts.values()) n += c;
    return n;
  }

  async countDue(folderId, algo) {
    algo = algo || this.settings.algo;
    const now = Date.now();
    let n = 0;
    await forEachCard(this.db, folderId || null, c => {
      if (SRS.isDue(c, algo, now)) n++;
    });
    return n;
  }

  async countDueBetween(folderId, algo, from, to) {
    algo = algo || this.settings.algo;
    let n = 0;
    await forEachCard(this.db, folderId || null, c => {
      if (SRS.isDueBetween(c, algo, from, to)) n++;
    });
    return n;
  }

  async countNew(folderId, algo) {
    algo = algo || this.settings.algo;
    let n = 0;
    await forEachCard(this.db, folderId || null, c => {
      if (SRS.isNew(c, algo)) n++;
    });
    return n;
  }

  async getReviewCards(folderId, algo, newLimit, now) {
    algo = algo || this.settings.algo;
    now = now || Date.now();
    const due = [];
    const fresh = [];
    await forEachCard(this.db, folderId || null, c => {
      if (SRS.isDue(c, algo, now)) due.push(c);
      else if (SRS.isNew(c, algo)) fresh.push(c);
    });
    return { due: shuffle(due), fresh: shuffle(fresh).slice(0, newLimit) };
  }

  async createFolder(data) {
    const f = {
      id: uuid(),
      name: data.name,
      color: data.color || '#7C8DB5',
      created_at: Date.now(),
      pack_id: data.pack_id || null,
      pack_version: data.pack_version ?? null,
    };
    await tx(this.db, 'folders', 'readwrite', s => s.put(f));
    this.folders.push(f);
    this.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    this._cardCounts.set(f.id, 0);
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
    this._folderCache.delete(id);
    this._cardCounts.delete(id);
  }

  findFolderByPackId(packId) {
    return this.folders.find(f => f.pack_id === packId) || null;
  }

  async importVocabPack(pack, onProgress) {
    if (!pack?.id || !Array.isArray(pack.cards)) throw new Error('Неверный формат пака');
    if (this.findFolderByPackId(pack.id)) throw new Error('Этот пак уже установлен');
    const cards = pack.cards.filter(c => c.front?.trim());
    const folder = await this.createFolder({
      name: pack.title,
      color: pack.color || '#7C8DB5',
      pack_id: pack.id,
      pack_version: pack.version ?? 1,
    });
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      await this.createCard({
        folder_id: folder.id,
        front: card.front,
        back: card.back || '',
        description: card.description || '',
      });
      if (onProgress) onProgress({ phase: 'import', done: i + 1, total: cards.length });
    }
    return folder;
  }

  async deleteVocabPack(packId) {
    const folder = this.findFolderByPackId(packId);
    if (!folder) throw new Error('Пак не установлен');
    await this.deleteFolder(folder.id);
  }

  async createCard(data) {
    const c = Object.assign({
      id: uuid(), created_at: Date.now(),
      front: '', back: '', description: '', front_img: null, back_img: null,
      sm2_ef: 2.5, sm2_reps: 0, sm2_ivl: 0, sm2_due: null,
      box: 0, box_due: null,
    }, data);
    await tx(this.db, 'cards', 'readwrite', s => s.put(c));
    const cached = this._folderCache.get(c.folder_id);
    if (cached) cached.unshift(c);
    this._cardCounts.set(c.folder_id, (this._cardCounts.get(c.folder_id) || 0) + 1);
    return c;
  }

  async updateCard(id, patch) {
    let c = null;
    for (const list of this._folderCache.values()) {
      c = list.find(x => x.id === id);
      if (c) break;
    }
    if (!c) {
      await forEachCard(this.db, null, card => {
        if (card.id === id) c = card;
      });
    }
    if (!c) return null;
    Object.assign(c, patch);
    await tx(this.db, 'cards', 'readwrite', s => s.put(c));
    return c;
  }

  async deleteCard(id) {
    let folderId = null;
    for (const [fid, list] of this._folderCache) {
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) { folderId = fid; list.splice(idx, 1); break; }
    }
    if (!folderId) {
      await forEachCard(this.db, null, card => {
        if (card.id === id) folderId = card.folder_id;
      });
    }
    await tx(this.db, 'cards', 'readwrite', s => s.delete(id));
    if (folderId) this._cardCounts.set(folderId, Math.max(0, (this._cardCounts.get(folderId) || 1) - 1));
  }

  async uploadImage(file) {
    const blob = await resizeImage(file);
    return blobToDataURL(blob);
  }

  async deleteImage() {}

  async saveSettings(s) {
    this.settings = s;
    localStorage.setItem('kar_settings_local', JSON.stringify(s));
  }

  async exportJSONFull() {
    const cards = await idbGetAll(this.db, 'cards');
    return JSON.stringify({ v: 1, folders: this.folders, cards, settings: this.settings }, null, 2);
  }

  async importJSON(text) {
    const data = JSON.parse(text);
    if (!data.folders || !data.cards) throw new Error('Неверный формат файла');
    for (const f of data.folders) {
      if (!this.folders.find(x => x.id === f.id)) {
        await tx(this.db, 'folders', 'readwrite', s => s.put(f));
        this.folders.push(f);
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
    this._folderCache.clear();
    await this._refreshCounts();
  }

  get offline() { return false; }
  async pendingSync() { return 0; }
  async flushSync() { return { ok: 0, fail: 0 }; }
}

