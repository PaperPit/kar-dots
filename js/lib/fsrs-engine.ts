import {
  fsrs,
  Rating,
  State,
  createEmptyCard,
  type FSRSCard,
  type FSRSScheduler
} from "../vendor/ts-fsrs.mjs"
import { DAY, MIN, fmtDays } from "./time-units.js"

interface StoredFsrsCard {
  fsrs_reps?: number | null
  fsrs_due?: number | null
  fsrs_state?: number | null
  fsrs_stability?: number | null
  fsrs_difficulty?: number | null
  fsrs_elapsed_days?: number | null
  fsrs_scheduled_days?: number | null
  fsrs_learning_steps?: number | null
  fsrs_lapses?: number | null
  fsrs_last_review?: number | null
}

export interface FsrsConfig {
  /** Желаемое удержание 0<r<=1 (по умолчанию 0.9). */
  requestRetention?: number
  /** Разброс интервалов (fuzz) — выравнивает пики нагрузки. */
  enableFuzz?: boolean
  /** Персональные веса FSRS (из официального оптимизатора). null/пусто = дефолтные. */
  w?: number[] | null
}

let scheduler: FSRSScheduler | null = null
let config: FsrsConfig = {}

/** Задать параметры планировщика FSRS (удержание, fuzz, веса). Сбрасывает кэш планировщика. */
export function configureFsrs(cfg: FsrsConfig): void {
  config = { ...cfg }
  scheduler = null
}

function getScheduler(): FSRSScheduler {
  if (!scheduler) {
    const params: Record<string, unknown> = {}
    if (typeof config.requestRetention === "number" && config.requestRetention > 0 && config.requestRetention <= 1) {
      params.request_retention = config.requestRetention
    }
    if (typeof config.enableFuzz === "boolean") params.enable_fuzz = config.enableFuzz
    if (Array.isArray(config.w) && config.w.length) params.w = config.w
    scheduler = fsrs(params)
  }
  return scheduler
}

/** Карточка ещё не изучалась алгоритмом FSRS. */
export function fsrsIsUntouched(card: StoredFsrsCard): boolean {
  return card.fsrs_reps == null && card.fsrs_due == null && card.fsrs_state == null
}

export function cardToFsrs(card: StoredFsrsCard, now = Date.now()): FSRSCard {
  if (fsrsIsUntouched(card)) return createEmptyCard(new Date(now))
  return {
    due: new Date(card.fsrs_due ?? now),
    stability: card.fsrs_stability ?? 0,
    difficulty: card.fsrs_difficulty ?? 0,
    elapsed_days: card.fsrs_elapsed_days ?? 0,
    scheduled_days: card.fsrs_scheduled_days ?? 0,
    learning_steps: card.fsrs_learning_steps ?? 0,
    reps: card.fsrs_reps ?? 0,
    lapses: card.fsrs_lapses ?? 0,
    state: card.fsrs_state ?? State.New,
    last_review: card.fsrs_last_review ? new Date(card.fsrs_last_review) : undefined
  }
}

export function fsrsToPatch(fsrsCard: FSRSCard): Record<string, number | null> {
  return {
    fsrs_state: fsrsCard.state,
    fsrs_stability: fsrsCard.stability,
    fsrs_difficulty: fsrsCard.difficulty,
    fsrs_due: fsrsCard.due.getTime(),
    fsrs_scheduled_days: fsrsCard.scheduled_days,
    fsrs_elapsed_days: fsrsCard.elapsed_days,
    fsrs_reps: fsrsCard.reps,
    fsrs_lapses: fsrsCard.lapses,
    fsrs_learning_steps: fsrsCard.learning_steps,
    fsrs_last_review: fsrsCard.last_review ? fsrsCard.last_review.getTime() : null
  }
}

export function fsrsNext(card: StoredFsrsCard, rating: number, now = Date.now()): Record<string, number | null> {
  const result = getScheduler().next(cardToFsrs(card, now), new Date(now), rating)
  return fsrsToPatch(result.card)
}

export function fsrsPreviewLabel(card: StoredFsrsCard, rating: number, now = Date.now()): string {
  const preview = getScheduler().repeat(cardToFsrs(card, now), new Date(now))
  return formatFsrsDue(preview[rating]!.card.due, now)
}

export function formatFsrsDue(dueDate: Date | number, now = Date.now()): string {
  const due = dueDate instanceof Date ? dueDate.getTime() : Number(dueDate)
  const ms = due - now
  if (ms <= 0) return "сейчас"
  if (ms < MIN) return "< 1 мин"
  if (ms < 60 * MIN) {
    const min = Math.max(1, Math.round(ms / MIN))
    return min + " мин"
  }
  if (ms < DAY) {
    const h = Math.round(ms / (60 * MIN))
    return h + " ч"
  }
  return fmtDays(ms / DAY)
}

export { Rating as FsrsRating, State as FsrsState }
