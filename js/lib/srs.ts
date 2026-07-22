// ============================================================
// КАР-точки — алгоритмы интервального повторения
// ============================================================

import { DAY, MIN, fmtDays } from "./time-units.js"
import type { Card } from "../data/types.js"

export { DAY, MIN, fmtDays }

export type Algo = "sm2" | "fsrs" | "leitner"

/** Минимальный набор SRS-полей, достаточный для предикатов due/new (slim meta совместим). */
export interface SrsRow {
  id?: string
  folder_id?: string
  folderId?: string
  sm2_ef?: number | null
  sm2_reps?: number | null
  sm2_ivl?: number | null
  sm2_due?: number | null
  box?: number | null
  box_due?: number | null
  fsrs_state?: unknown
  fsrs_stability?: number | null
  fsrs_difficulty?: number | null
  fsrs_due?: number | null
  fsrs_scheduled_days?: number | null
  fsrs_elapsed_days?: number | null
  fsrs_reps?: number | null
  fsrs_lapses?: number | null
  fsrs_learning_steps?: unknown
  fsrs_last_review?: number | null
}

export interface SrsCard extends Card, SrsRow {
  folder_id?: string
  folderId?: string
  description?: string
  front_img?: string
  back_img?: string
}

export interface FsrsConfig {
  requestRetention?: number
  enableFuzz?: boolean
  w?: number[] | null
}

interface FsrsEngineModule {
  fsrsIsUntouched(card: SrsCard): boolean
  fsrsPreviewLabel(card: SrsCard, rating: number, now?: number): string
  fsrsNext(card: SrsCard, rating: number, now?: number): Record<string, number | null>
  configureFsrs(cfg: FsrsConfig): void
}

interface Sm2Result {
  sm2_ef: number
  sm2_reps: number
  sm2_ivl: number
  sm2_due: number
}

interface LeitnerResult {
  box: number
  box_due: number
}

/** Без ts-fsrs: нужны для due/new и UI-грейдинга при любом algo. */
export function fsrsIsUntouched(card: SrsRow): boolean {
  return card.fsrs_reps == null && card.fsrs_due == null && card.fsrs_state == null
}

/** Совпадает с Rating из ts-fsrs. */
export const FsrsRating = Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 })

let _fsrs: FsrsEngineModule | null = null
let _fsrsPromise: Promise<FsrsEngineModule> | null = null

/** Подгрузить fsrs-engine + ts-fsrs (только когда algo === fsrs). */
export function preloadFsrs(): Promise<FsrsEngineModule> {
  if (_fsrs) return Promise.resolve(_fsrs)
  if (!_fsrsPromise) {
    _fsrsPromise = import("./fsrs-engine.js").then((m) => {
      _fsrs = m as unknown as FsrsEngineModule
      return _fsrs
    })
  }
  return _fsrsPromise
}

function needFsrs(): FsrsEngineModule {
  if (!_fsrs) {
    throw new Error("FSRS не загружен — сначала await preloadFsrs()")
  }
  return _fsrs
}

/** Применить параметры планировщика FSRS (после preloadFsrs). Тихо игнорирует, если движок не загружен. */
export function configureFsrs(cfg: FsrsConfig): void {
  if (_fsrs) _fsrs.configureFsrs(cfg)
}

/** Собрать конфиг FSRS из пользовательских настроек. */
export function fsrsConfigFromSettings(s: { fsrsRetention?: number; fsrsFuzz?: boolean; fsrsWeights?: number[] | null }): FsrsConfig {
  return {
    requestRetention: typeof s.fsrsRetention === "number" ? s.fsrsRetention : 0.9,
    enableFuzz: s.fsrsFuzz !== false,
    w: Array.isArray(s.fsrsWeights) && s.fsrsWeights.length ? s.fsrsWeights : null
  }
}

export function sm2Next(card: SrsCard, quality: number, now: number): Sm2Result {
  now = now || Date.now()
  let ef = card.sm2_ef || 2.5
  let reps = card.sm2_reps || 0
  let ivl = card.sm2_ivl || 0

  if (quality < 3) {
    reps = 0
    ivl = 0
    ef = Math.max(1.3, ef - 0.2)
    return { sm2_ef: ef, sm2_reps: reps, sm2_ivl: ivl, sm2_due: now + 10 * MIN }
  }

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  ef = Math.max(1.3, ef)
  reps += 1

  if (reps === 1) ivl = quality === 5 ? 4 : 1
  else if (reps === 2) ivl = quality === 5 ? 8 : 6
  else ivl = Math.round(ivl * ef)

  if (quality === 3) ivl = Math.max(1, Math.round(ivl * 0.8))
  ivl = Math.min(ivl, 365)

  return { sm2_ef: ef, sm2_reps: reps, sm2_ivl: ivl, sm2_due: now + ivl * DAY }
}

export function leitnerNext(card: SrsCard, remembered: boolean, intervals: number[], now: number): LeitnerResult {
  now = now || Date.now()
  intervals = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16]
  let box = card.box || 0
  if (remembered) box = Math.min(5, box + 1)
  else box = 1
  const days = intervals[box - 1] ?? 1
  return { box: box, box_due: now + days * DAY }
}

export function dueOf(card: SrsRow, algo: Algo): number | null {
  if (algo === "leitner") return card.box ? card.box_due ?? null : null
  if (algo === "fsrs") return fsrsIsUntouched(card) ? null : (card.fsrs_due ?? null)
  return card.sm2_reps || card.sm2_due ? card.sm2_due ?? null : null
}

export function isNew(card: SrsRow, algo: Algo): boolean {
  if (algo === "leitner") return !card.box
  if (algo === "fsrs") return fsrsIsUntouched(card)
  return !card.sm2_reps && !card.sm2_due
}

export function isDue(card: SrsRow, algo: Algo, now: number): boolean {
  now = now || Date.now()
  const d = dueOf(card, algo)
  return d !== null && d !== undefined && d <= now
}

/** Границы календарного дня (локальное время). */
export function dayBounds(date: Date = new Date()): { start: number; end: number } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

/** Карточка запланирована на повтор в интервале [from, to]. */
export function isDueBetween(card: SrsRow, algo: Algo, from: number, to: number): boolean {
  const d = dueOf(card, algo)
  if (d == null) return false
  return d >= from && d <= to
}

/** Пора повторять или ещё не изучалась. */
export function isReviewable(card: SrsRow, algo: Algo, now: number): boolean {
  return isDue(card, algo, now) || isNew(card, algo)
}

export function sm2Preview(card: SrsCard, quality: number, now: number): string {
  const r = sm2Next(Object.assign({}, card), quality, now)
  if (quality < 3) return "10 мин"
  return fmtDays(r.sm2_ivl)
}

export function leitnerPreview(card: SrsCard, remembered: boolean, intervals?: number[]): string {
  const r = leitnerNext(Object.assign({}, card), remembered, intervals ?? [1, 2, 4, 8, 16], Date.now())
  const ivs = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16]
  return fmtDays(ivs[r.box - 1] ?? 1)
}

export function fsrsPreview(card: SrsCard, rating: number, now: number): string {
  return needFsrs().fsrsPreviewLabel(card, rating, now)
}

/** Поля SRS для отката оценки. */
export function srsSnapshot(card: SrsCard, algo: Algo): Record<string, number | null> {
  if (algo === "leitner") {
    return { box: card.box ?? 0, box_due: card.box_due ?? null }
  }
  if (algo === "fsrs") {
    return {
      fsrs_state: (card.fsrs_state as number | null) ?? null,
      fsrs_stability: card.fsrs_stability ?? null,
      fsrs_difficulty: card.fsrs_difficulty ?? null,
      fsrs_due: card.fsrs_due ?? null,
      fsrs_scheduled_days: card.fsrs_scheduled_days ?? null,
      fsrs_elapsed_days: card.fsrs_elapsed_days ?? null,
      fsrs_reps: card.fsrs_reps ?? null,
      fsrs_lapses: card.fsrs_lapses ?? null,
      fsrs_learning_steps: (card.fsrs_learning_steps as number | null) ?? null,
      fsrs_last_review: card.fsrs_last_review ?? null
    }
  }
  return {
    sm2_ef: card.sm2_ef ?? 2.5,
    sm2_reps: card.sm2_reps ?? 0,
    sm2_ivl: card.sm2_ivl ?? 0,
    sm2_due: card.sm2_due ?? null
  }
}

export function fsrsNext(card: SrsCard, rating: number, now: number): Record<string, number | null> {
  return needFsrs().fsrsNext(card, rating, now)
}
