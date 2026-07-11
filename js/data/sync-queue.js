// ============================================================
// Очередь синхронизации для облачного режима без интернета
// ============================================================

import { isNetworkError } from './supabase.js';

const MIRROR_DB = 'kartochki_cloud';
// 3: в браузерах, где успела поработать промежуточная реализация YouTube-импорта,
// база уже поднята до версии 3 — IndexedDB не разрешает открывать её с меньшей.
// Апгрейд-обработчик идемпотентен (все createObjectStore под проверками contains),
// поэтому для баз версии 2 это просто безопасный no-op-апгрейд.
const MIRROR_VERSION = 4;
const QUEUE_STORE = 'sync_queue';
const DEAD_LETTER_STORE = 'sync_dead_letters';

function openMirrorDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MIRROR_DB, MIRROR_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cards')) {
        const cards = db.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('folder_id', 'folder_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('boxes')) db.createObjectStore('boxes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txAll(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    fn(s);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getOne(db, store, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export { openMirrorDB, getAll, txAll, MIRROR_DB };

export class SyncQueue {
  constructor() {
    this.db = null;
    this.flushing = false;
    this._handler = null;
    this._deadLetterHandler = null;
  }

  async init(db) {
    this.db = db;
  }

  async size() {
    const items = await getAll(this.db, QUEUE_STORE);
    return items.length;
  }

  async deadLetterCount() {
    const items = await getAll(this.db, DEAD_LETTER_STORE);
    return items.length;
  }

  async deadLetters() {
    const items = await getAll(this.db, DEAD_LETTER_STORE);
    items.sort((a, b) => (a.failed_at || 0) - (b.failed_at || 0));
    return items;
  }

  async enqueue(item) {
    await txAll(this.db, QUEUE_STORE, 'readwrite', s => {
      s.add(Object.assign({ created_at: Date.now() }, item));
    });
  }

  onFlush(handler) {
    this._handler = handler;
  }

  onDeadLetter(handler) {
    this._deadLetterHandler = handler;
  }

  async _moveToDeadLetter(item, error) {
    const letter = {
      op: item.op,
      payload: item.payload,
      error: String(error?.message || error),
      created_at: item.created_at,
      failed_at: Date.now(),
    };
    await txAll(this.db, DEAD_LETTER_STORE, 'readwrite', s => s.add(letter));
    if (this._deadLetterHandler) {
      const letters = await this.deadLetters();
      this._deadLetterHandler(letters[letters.length - 1]);
    }
  }

  async retryDeadLetter(id) {
    const letter = await getOne(this.db, DEAD_LETTER_STORE, id);
    if (!letter) return false;
    await this.enqueue({ op: letter.op, payload: letter.payload });
    await txAll(this.db, DEAD_LETTER_STORE, 'readwrite', s => s.delete(id));
    return true;
  }

  async discardDeadLetter(id) {
    const letter = await getOne(this.db, DEAD_LETTER_STORE, id);
    if (!letter) return false;
    await txAll(this.db, DEAD_LETTER_STORE, 'readwrite', s => s.delete(id));
    return true;
  }

  async flush() {
    if (this.flushing || !this._handler || !navigator.onLine) return { ok: 0, fail: 0 };
    this.flushing = true;
    let ok = 0;
    let fail = 0;
    try {
      const items = await getAll(this.db, QUEUE_STORE);
      items.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      for (const item of items) {
        try {
          await this._handler(item);
          await txAll(this.db, QUEUE_STORE, 'readwrite', s => s.delete(item.id));
          ok++;
        } catch (e) {
          if (isNetworkError(e)) break;
          await this._moveToDeadLetter(item, e);
          await txAll(this.db, QUEUE_STORE, 'readwrite', s => s.delete(item.id));
          fail++;
        }
      }
    } finally {
      this.flushing = false;
    }
    return { ok, fail };
  }
}

export async function mirrorReplaceAll(db, storeName, rows) {
  await txAll(db, storeName, 'readwrite', s => {
    s.clear();
    rows.forEach(r => s.put(r));
  });
}

export async function mirrorPut(db, storeName, row) {
  await txAll(db, storeName, 'readwrite', s => s.put(row));
}

export async function mirrorDelete(db, storeName, id) {
  await txAll(db, storeName, 'readwrite', s => s.delete(id));
}

export async function mirrorGetKV(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function mirrorSetKV(db, key, value) {
  await txAll(db, 'kv', 'readwrite', s => s.put(value, key));
}

export function indexGetAll(db, storeName, indexName, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName).objectStore(storeName).index(indexName).getAll(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
