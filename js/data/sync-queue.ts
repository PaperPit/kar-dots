// ============================================================
// Очередь синхронизации для облачного режима без интернета
// ============================================================

import { isNetworkError } from "./supabase.js"

const MIRROR_DB = "kartochki_cloud"
// 3: в браузерах, где успела поработать промежуточная реализация YouTube-импорта,
// база уже поднята до версии 3 — IndexedDB не разрешает открывать её с меньшей.
// 4: boxes / sync stores.
// 5: notes + note_conflicts + note_terms (база знаний).
// Апгрейд-обработчик идемпотентен (все createObjectStore под проверками contains),
// поэтому для баз версии 2–4 это просто безопасный no-op-апгрейд.
const MIRROR_VERSION = 5
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
        cards.createIndex("note_id", "note_id", { unique: false })
      } else if (req.transaction) {
        const cards = req.transaction.objectStore("cards")
        if (!cards.indexNames.contains("folder_id")) {
          cards.createIndex("folder_id", "folder_id", { unique: false })
        }
        if (!cards.indexNames.contains("note_id")) {
          cards.createIndex("note_id", "note_id", { unique: false })
        }
      }
      if (!db.objectStoreNames.contains("boxes")) db.createObjectStore("boxes", { keyPath: "id" })
      if (!db.objectStoreNames.contains("notes")) {
        const notes = db.createObjectStore("notes", { keyPath: "id" })
        notes.createIndex("updated_at", "updated_at", { unique: false })
        notes.createIndex("conflict_of", "conflict_of", { unique: false })
      }
      if (!db.objectStoreNames.contains("note_conflicts")) {
        const conflicts = db.createObjectStore("note_conflicts", { keyPath: "id" })
        conflicts.createIndex("conflict_of", "conflict_of", { unique: false })
      }
      if (!db.objectStoreNames.contains("note_terms")) {
        const terms = db.createObjectStore("note_terms", { keyPath: "id" })
        terms.createIndex("term", "term", { unique: false })
        terms.createIndex("note_id", "note_id", { unique: false })
      }
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

  /**
   * Дописать cardId в отложённую загрузку картинки.
   *
   * Картинку роняют в редактор до того, как карточка создана, поэтому в очередь
   * она попадает без привязки. Здесь элемент удаляется и кладётся заново — с
   * новым created_at, то есть уже ПОСЛЕ createCard/updateCard в порядке flush.
   * Иначе offline-загрузка ушла бы в облако раньше самой карточки, и патч
   * front_img/back_img перезаписался бы старым (data-URL) значением.
   *
   * @returns true, если нашлась и была привязана незакрытая загрузка.
   */
  async bindPendingUpload(side: string, cardId: string): Promise<boolean> {
    if (!side || !cardId) return false
    const items = await getAll<QueueItem>(this.requireDB(), QUEUE_STORE)
    const pending = items
      .filter((it) => {
        if (it.op !== "uploadImage") return false
        const p = (it.payload || {}) as { side?: string; cardId?: string }
        return p.side === side && !p.cardId
      })
      .sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    const item = pending[0]
    if (!item || item.id === undefined) return false
    await txAll(this.requireDB(), QUEUE_STORE, "readwrite", (s) => s.delete(item.id as number))
    await this.enqueue({
      op: item.op,
      payload: Object.assign({}, item.payload as Record<string, unknown>, { cardId })
    })
    return true
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

/**
 * Слияние частичной строки в уже лежащую в зеркале полную.
 *
 * Дельта-выборки тянут только проекцию (SRS + пара полей карточки). Если такую
 * строку просто положить через put, из зеркала пропадут поля, которых в
 * проекции нет — офлайн карточка окажется без описания и картинок.
 * `undefined` в incoming значит «поля не было в проекции», null — «поле реально
 * очистили на сервере», поэтому null сохраняем.
 */
export function mergeMirrorRow<T extends Record<string, unknown>>(
  existing: T | null | undefined,
  incoming: T
): T {
  if (!existing) return incoming
  const merged = Object.assign({}, existing) as Record<string, unknown>
  for (const key of Object.keys(incoming)) {
    const value = (incoming as Record<string, unknown>)[key]
    if (value === undefined) continue
    merged[key] = value
  }
  return merged as T
}

/** Прочитать несколько строк по ключам одной транзакцией (порядок = порядок ids). */
export function mirrorGetMany<T = unknown>(
  db: IDBDatabase,
  storeName: string,
  ids: IDBValidKey[]
): Promise<(T | undefined)[]> {
  if (!ids?.length) return Promise.resolve([])
  return new Promise<(T | undefined)[]>((resolve, reject) => {
    const t = db.transaction(storeName)
    const s = t.objectStore(storeName)
    const out: (T | undefined)[] = new Array(ids.length)
    let left = ids.length
    let failed = false
    ids.forEach((id, i) => {
      const req = s.get(id)
      req.onsuccess = () => {
        out[i] = req.result
        if (--left === 0 && !failed) resolve(out)
      }
      req.onerror = () => {
        if (!failed) {
          failed = true
          reject(req.error)
        }
      }
    })
  })
}

/**
 * Положить строки в зеркало, доливая недостающие поля из уже сохранённых.
 * Читаем и пишем разными транзакциями осознанно: читать и писать в одной
 * readwrite-транзакции здесь нечем — все ключи известны заранее, а гонок с
 * другими писателями в одном табе нет.
 */
export async function mirrorMergeMany<T extends Record<string, unknown>>(
  db: IDBDatabase,
  storeName: string,
  rows: T[],
  keyPath = "id"
) {
  if (!rows?.length) return
  const ids = rows.map((r) => r[keyPath] as IDBValidKey)
  const existing = await mirrorGetMany<T>(db, storeName, ids)
  const merged = rows.map((row, i) => mergeMirrorRow(existing[i], row))
  await mirrorPutMany(db, storeName, merged)
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
