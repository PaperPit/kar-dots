// ============================================================
// КАР-точки — журнал повторений (append-only)
// Фундамент для статистики удержания, прогноза нагрузки и оптимизации FSRS.
// Хранится в отдельной IndexedDB (независимо от режима local/cloud),
// работает офлайн. Облачная синхронизация — best-effort через хуки.
// ============================================================

import type { Algo } from "./srs.js"

export interface ReviewLogEntry {
  /** Стабильный UUID — идемпотентный upsert в облаке, без дедупликации. */
  id: string
  /** Момент оценки (Date.now()). */
  ts: number
  card_id: string
  folder_id: string
  algo: Algo
  /** 1..4 (FSRS-совместимо): Again/Hard/Good/Easy. Для sm2/leitner: помню→3, не помню→1. */
  rating: number
  /** Засчитано как «помню» (1) или «не помню» (0). */
  known: 0 | 1
  /** Дней прошло с прошлого показа карточки (0 — первый показ / новая). */
  elapsed_days: number
  /** Состояние до оценки: 0 new, 1 learning, 2 review, 3 relearning. */
  state_before: number
  /** Стабильность FSRS до оценки (если алгоритм FSRS), иначе null. */
  stability_before: number | null
}

export interface ReviewLogCloudSync {
  push: (entry: ReviewLogEntry) => void
  remove: (id: string) => void
}

const IDB_NAME = "kartochki_reviewlog"
const STORE = "events"

let dbReady: Promise<IDBDatabase | null> | null = null
let cloudSync: ReviewLogCloudSync | null = null

function rid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return "rrrrrrrr-rrrr-4rrr-yrrr-rrrrrrrrrrrr".replace(/[ry]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "r" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function openLogDB(): Promise<IDBDatabase | null> {
  if (!dbReady) {
    dbReady = new Promise<IDBDatabase | null>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        resolve(null)
        return
      }
      const req = indexedDB.open(IDB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" })
          s.createIndex("ts", "ts", { unique: false })
          s.createIndex("card_id", "card_id", { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }).catch(() => null)
  }
  return dbReady
}

/** CloudStore вешает сюда push/remove; LocalStore — null. */
export function setReviewLogCloudSync(fn: ReviewLogCloudSync | null): void {
  cloudSync = fn
}

/** Гарантировать открытие БД (вызывается при старте). */
export async function initReviewLog(): Promise<void> {
  await openLogDB()
}

/** Собрать запись журнала из данных оценки. */
export function buildReviewEntry(input: {
  card_id: string
  folder_id: string
  algo: Algo
  rating: number
  known: boolean
  elapsed_days: number
  state_before: number
  stability_before?: number | null
  ts?: number
}): ReviewLogEntry {
  return {
    id: rid(),
    ts: input.ts ?? Date.now(),
    card_id: input.card_id,
    folder_id: input.folder_id,
    algo: input.algo,
    rating: input.rating,
    known: input.known ? 1 : 0,
    elapsed_days: Math.max(0, Math.round(input.elapsed_days * 100) / 100),
    state_before: input.state_before,
    stability_before: input.stability_before ?? null
  }
}

/** Записать событие. Возвращает id (для отмены). Не бросает — журнал не должен ломать оценку. */
export async function logReview(entry: ReviewLogEntry): Promise<string> {
  try {
    const db = await openLogDB()
    if (db) {
      await new Promise<void>((resolve) => {
        const t = db.transaction(STORE, "readwrite")
        t.objectStore(STORE).put(entry)
        t.oncomplete = () => resolve()
        t.onerror = () => resolve()
      })
    }
  } catch (e) {
    console.warn("review-log put", e)
  }
  if (cloudSync) {
    try { cloudSync.push(entry) } catch (e) { console.warn("review-log cloud push", e) }
  }
  return entry.id
}

/** Удалить событие (отмена оценки). */
export async function removeReview(id: string): Promise<void> {
  try {
    const db = await openLogDB()
    if (db) {
      await new Promise<void>((resolve) => {
        const t = db.transaction(STORE, "readwrite")
        t.objectStore(STORE).delete(id)
        t.oncomplete = () => resolve()
        t.onerror = () => resolve()
      })
    }
  } catch (e) {
    console.warn("review-log delete", e)
  }
  if (cloudSync) {
    try { cloudSync.remove(id) } catch (e) { console.warn("review-log cloud remove", e) }
  }
}

/** Все события, отсортированы по времени (по возрастанию). */
export async function getAllReviews(): Promise<ReviewLogEntry[]> {
  const db = await openLogDB()
  if (!db) return []
  const rows = await new Promise<ReviewLogEntry[]>((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as ReviewLogEntry[]) || [])
    req.onerror = () => resolve([])
  })
  rows.sort((a, b) => (a.ts || 0) - (b.ts || 0))
  return rows
}

/** События с ts строго больше указанного (для инкрементального pull). */
export async function getReviewsSince(ts: number): Promise<ReviewLogEntry[]> {
  const all = await getAllReviews()
  return all.filter((r) => (r.ts || 0) > ts)
}

export async function countReviews(): Promise<number> {
  const db = await openLogDB()
  if (!db) return 0
  return new Promise<number>((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result || 0)
    req.onerror = () => resolve(0)
  })
}

/** Наибольший ts среди локальных событий (курсор для pull). */
export async function lastReviewTs(): Promise<number> {
  const all = await getAllReviews()
  return all.length ? all[all.length - 1]!.ts || 0 : 0
}

/** Слить события из облака (put тех, которых ещё нет). Возвращает число добавленных. */
export async function applyRemoteReviews(rows: ReviewLogEntry[] | null | undefined): Promise<number> {
  if (!rows?.length) return 0
  const db = await openLogDB()
  if (!db) return 0
  const existing = new Set((await getAllReviews()).map((r) => r.id))
  const fresh = rows.filter((r) => r && r.id && !existing.has(r.id))
  if (!fresh.length) return 0
  await new Promise<void>((resolve) => {
    const t = db.transaction(STORE, "readwrite")
    const s = t.objectStore(STORE)
    for (const r of fresh) s.put(r)
    t.oncomplete = () => resolve()
    t.onerror = () => resolve()
  })
  return fresh.length
}

/** Полностью очистить журнал (для «Сбросить данные»). */
export async function clearReviewLog(): Promise<void> {
  const db = await openLogDB()
  if (!db) return
  await new Promise<void>((resolve) => {
    const t = db.transaction(STORE, "readwrite")
    t.objectStore(STORE).clear()
    t.oncomplete = () => resolve()
    t.onerror = () => resolve()
  })
}
