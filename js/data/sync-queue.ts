// ============================================================
// Очередь синхронизации для облачного режима без интернета
// ============================================================

import { isNetworkError } from "./supabase.js"

const MIRROR_DB = "kartochki_cloud"
// 3: в браузерах, где успела поработать промежуточная реализация YouTube-импорта,
// база уже поднята до версии 3 — IndexedDB не разрешает открывать её с меньшей.
// Апгрейд-обработчик идемпотентен (все createObjectStore под проверками contains),
// поэтому для баз версии 2 это просто безопасный no-op-апгрейд.
const MIRROR_VERSION = 4
const QUEUE_STORE = "sync_queue"
const DEAD_LETTER_STORE = "sync_dead_letters"

interface QueueItem {
  id?: number
  op: string
  payload: unknown
  created_at?: number | undefined
  [key: string]: unknown
}

interface DeadLetter {
  id?: number
  op: string
  payload: unknown
  error: string
  created_at?: number | undefined
  failed_at: number
  [key: string]: unknown
}

function openMirrorDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MIRROR_DB, MIRROR_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("folders"))
        db.createObjectStore("folders", { keyPath: "id" })
      if (!db.objectStoreNames.contains("cards")) {
        const cards = db.createObjectStore("cards", { keyPath: "id" })
        cards.createIndex("folder_id", "folder_id", { unique: false })
      }
      if (!db.objectStoreNames.contains("boxes")) db.createObjectStore("boxes", { keyPath: "id" })
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv")
      if (!db.objectStoreNames.contains(QUEUE_STORE))
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true })
      if (!db.objectStoreNames.contains(DEAD_LETTER_STORE))
        db.createObjectStore(DEAD_LETTER_STORE, { keyPath: "id", autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txAll(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const t = db!.transaction(store, mode)
    const s = t.objectStore(store)
    fn(s)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const req = db!.transaction(store).objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getOne<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    const req = db!.transaction(store).objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbCount(db: IDBDatabase, store: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const req = db!.transaction(store).objectStore(store).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export { openMirrorDB, getAll, txAll, MIRROR_DB }

export class SyncQueue {
  db: IDBDatabase | null = null
  private flushing = false
  private _handler: ((item: QueueItem) => Promise<void>) | null = null
  private _deadLetterHandler: ((letter: DeadLetter) => void) | null = null

  constructor() {}

  private requireDB(): IDBDatabase {
    if (!this.db) throw new Error("SyncQueue не инициализирован")
    return this.db
  }

  async init(db: IDBDatabase) {
    this.db = db
  }

  async size(): Promise<number> {
    return idbCount(this.requireDB(), QUEUE_STORE)
  }

  async deadLetterCount(): Promise<number> {
    return idbCount(this.requireDB(), DEAD_LETTER_STORE)
  }

  async deadLetters(): Promise<DeadLetter[]> {
    const items = await getAll<DeadLetter>(this.requireDB(), DEAD_LETTER_STORE)
    items.sort((a, b) => (a.failed_at || 0) - (b.failed_at || 0))
    return items
  }

  async enqueue(item: QueueItem) {
    await txAll(this.requireDB(), QUEUE_STORE, "readwrite", (s) => {
      s.add(Object.assign({ created_at: Date.now() }, item))
    })
  }

  onFlush(handler: (item: QueueItem) => Promise<void>) {
    this._handler = handler
  }

  onDeadLetter(handler: (letter: DeadLetter) => void) {
    this._deadLetterHandler = handler
  }

  async _moveToDeadLetter(item: QueueItem, error: unknown) {
    const letter: DeadLetter = {
      op: item.op,
      payload: item.payload,
      error: error instanceof Error ? error.message : String(error),
      created_at: item.created_at,
      failed_at: Date.now()
    }
    await txAll(this.requireDB(), DEAD_LETTER_STORE, "readwrite", (s) => s.add(letter))
    if (this._deadLetterHandler) {
      const letters = await this.deadLetters()
      const last = letters[letters.length - 1]
      if (last) this._deadLetterHandler(last)
    }
  }

  async retryDeadLetter(id: number): Promise<boolean> {
    const letter = await getOne<DeadLetter>(this.requireDB(), DEAD_LETTER_STORE, id)
    if (!letter) return false
    await this.enqueue({ op: letter.op, payload: letter.payload })
    await txAll(this.requireDB(), DEAD_LETTER_STORE, "readwrite", (s) => s.delete(id))
    return true
  }

  async discardDeadLetter(id: number): Promise<boolean> {
    const letter = await getOne<DeadLetter>(this.requireDB(), DEAD_LETTER_STORE, id)
    if (!letter) return false
    await txAll(this.requireDB(), DEAD_LETTER_STORE, "readwrite", (s) => s.delete(id))
    return true
  }

  async flush(): Promise<{ ok: number; fail: number }> {
    if (this.flushing || !this._handler || !navigator.onLine) return { ok: 0, fail: 0 }
    this.flushing = true
    let ok = 0
    let fail = 0
    try {
      const items = await getAll<QueueItem>(this.requireDB(), QUEUE_STORE)
      items.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
      for (const item of items) {
        try {
          if (this._handler) await this._handler(item)
          await txAll(this.requireDB(), QUEUE_STORE, "readwrite", (s) => {
            if (item.id !== undefined) s.delete(item.id)
          })
          ok++
        } catch (e) {
          if (isNetworkError(e)) break
          await this._moveToDeadLetter(item, e)
          await txAll(this.requireDB(), QUEUE_STORE, "readwrite", (s) => {
            if (item.id !== undefined) s.delete(item.id)
          })
          fail++
        }
      }
    } finally {
      this.flushing = false
    }
    return { ok, fail }
  }
}

export async function mirrorReplaceAll(db: IDBDatabase, storeName: string, rows: unknown[]) {
  await txAll(db, storeName, "readwrite", (s) => {
    s.clear()
    rows.forEach((r) => s.put(r))
  })
}

export async function mirrorPut(db: IDBDatabase, storeName: string, row: unknown) {
  await txAll(db, storeName, "readwrite", (s) => s.put(row))
}

/** Одна IDB-транзакция для массива строк (вместо N отдельных mirrorPut). */
export async function mirrorPutMany(db: IDBDatabase, storeName: string, rows: unknown[]) {
  if (!rows?.length) return
  await txAll(db, storeName, "readwrite", (s) => {
    for (const row of rows) s.put(row)
  })
}

export async function mirrorDelete(db: IDBDatabase, storeName: string, id: IDBValidKey) {
  await txAll(db, storeName, "readwrite", (s) => s.delete(id))
}

/** Одна IDB-транзакция для удаления многих id. */
export async function mirrorDeleteMany(db: IDBDatabase, storeName: string, ids: IDBValidKey[]) {
  if (!ids?.length) return
  await txAll(db, storeName, "readwrite", (s) => {
    for (const id of ids) s.delete(id)
  })
}

export async function mirrorGetKV(db: IDBDatabase, key: IDBValidKey): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const req = db!.transaction("kv").objectStore("kv").get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function mirrorSetKV(db: IDBDatabase, key: IDBValidKey, value: unknown) {
  await txAll(db, "kv", "readwrite", (s) => s.put(value, key))
}

export function indexGetAll<T = unknown>(db: IDBDatabase | null, storeName: string, indexName: string, key: IDBValidKey): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const req = db!.transaction(storeName).objectStore(storeName).index(indexName).getAll(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
