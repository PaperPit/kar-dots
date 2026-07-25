/**
 * Перенос приблизительного прогресса между алгоритмами SRS.
 * Колонки SM-2 / Leitner / FSRS независимы: без сидирования новый алгоритм
 * видит все карточки как новые (dueOf/isNew смотрят только активные поля).
 */

import { DAY, type Algo, type SrsRow, isNew } from "./srs.js"
import { fsrsIsUntouched, FsrsState } from "./fsrs-engine.js"

export type AlgoConvertSettings = {
  leitnerIntervals?: number[]
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** EF 1.3…2.5 → difficulty FSRS ~10…1 (выше EF = легче). */
function efToDifficulty(ef: number): number {
  return clamp(19 - 7 * (Number(ef) || 2.5), 1, 10)
}

/** FSRS difficulty 1…10 → EF. */
function difficultyToEf(d: number): number {
  return clamp(2.5 - ((Number(d) || 5) - 1) * (1.2 / 9), 1.3, 2.5)
}

function leitnerIvl(card: SrsRow, intervals?: number[]): number {
  const box = Number(card.box) || 0
  if (!box) return 0
  const ivs = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16]
  return ivs[box - 1] ?? 1
}

function seedFsrsFromSm2(card: SrsRow): Record<string, number | null> | null {
  if (!card.sm2_reps && !card.sm2_due) return null
  const ivl = Math.max(0.1, Number(card.sm2_ivl) || 1)
  const due = Number(card.sm2_due) || Date.now()
  const reps = Number(card.sm2_reps) || 0
  const last = due - ivl * DAY
  return {
    fsrs_state: reps >= 2 ? FsrsState.Review : reps >= 1 ? FsrsState.Learning : FsrsState.New,
    fsrs_stability: ivl,
    fsrs_difficulty: efToDifficulty(Number(card.sm2_ef) || 2.5),
    fsrs_due: due,
    fsrs_scheduled_days: ivl,
    fsrs_elapsed_days: ivl,
    fsrs_reps: reps,
    fsrs_lapses: 0,
    fsrs_learning_steps: 0,
    fsrs_last_review: last > 0 ? last : null,
  }
}

function seedFsrsFromLeitner(card: SrsRow, intervals?: number[]): Record<string, number | null> | null {
  const box = Number(card.box) || 0
  if (!box) return null
  const ivl = Math.max(0.1, leitnerIvl(card, intervals))
  const due = Number(card.box_due) || Date.now()
  const last = due - ivl * DAY
  return {
    fsrs_state: box >= 2 ? FsrsState.Review : FsrsState.Learning,
    fsrs_stability: ivl,
    fsrs_difficulty: 5,
    fsrs_due: due,
    fsrs_scheduled_days: ivl,
    fsrs_elapsed_days: ivl,
    fsrs_reps: box,
    fsrs_lapses: 0,
    fsrs_learning_steps: 0,
    fsrs_last_review: last > 0 ? last : null,
  }
}

function seedSm2FromFsrs(card: SrsRow): Record<string, number | null> | null {
  if (fsrsIsUntouched(card as Parameters<typeof fsrsIsUntouched>[0])) return null
  const ivl = Math.max(1, Math.round(Number(card.fsrs_scheduled_days) || Number(card.fsrs_stability) || 1))
  return {
    sm2_ef: difficultyToEf(Number(card.fsrs_difficulty) || 5),
    sm2_reps: Math.max(0, Number(card.fsrs_reps) || 0),
    sm2_ivl: ivl,
    sm2_due: Number(card.fsrs_due) || Date.now() + ivl * DAY,
  }
}

function seedSm2FromLeitner(card: SrsRow, intervals?: number[]): Record<string, number | null> | null {
  const box = Number(card.box) || 0
  if (!box) return null
  const ivl = Math.max(1, leitnerIvl(card, intervals))
  return {
    sm2_ef: 2.5,
    sm2_reps: box,
    sm2_ivl: ivl,
    sm2_due: Number(card.box_due) || Date.now() + ivl * DAY,
  }
}

function seedLeitnerFromSm2(card: SrsRow, intervals?: number[]): Record<string, number | null> | null {
  if (!card.sm2_reps && !card.sm2_due) return null
  const ivl = Number(card.sm2_ivl) || 1
  const ivs = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16]
  let box = 1
  for (let i = 0; i < ivs.length; i++) {
    if (ivl >= (ivs[i] ?? 0)) box = i + 1
  }
  return {
    box,
    box_due: Number(card.sm2_due) || Date.now() + (ivs[box - 1] ?? 1) * DAY,
  }
}

function seedLeitnerFromFsrs(card: SrsRow, intervals?: number[]): Record<string, number | null> | null {
  if (fsrsIsUntouched(card as Parameters<typeof fsrsIsUntouched>[0])) return null
  const ivl = Number(card.fsrs_scheduled_days) || Number(card.fsrs_stability) || 1
  const ivs = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16]
  let box = 1
  for (let i = 0; i < ivs.length; i++) {
    if (ivl >= (ivs[i] ?? 0)) box = i + 1
  }
  return {
    box,
    box_due: Number(card.fsrs_due) || Date.now() + (ivs[box - 1] ?? 1) * DAY,
  }
}

/**
 * Патч для карточки при переходе from → to.
 * null — нечего переносить (цель уже не пустая или источник без прогресса).
 */
export function convertAlgoPatch(
  card: SrsRow,
  from: Algo,
  to: Algo,
  settings: AlgoConvertSettings = {}
): Record<string, number | null> | null {
  if (!from || !to || from === to) return null
  if (!isNew(card, to)) return null

  if (to === "fsrs") {
    if (from === "sm2") return seedFsrsFromSm2(card)
    if (from === "leitner") return seedFsrsFromLeitner(card, settings.leitnerIntervals)
  }
  if (to === "sm2") {
    if (from === "fsrs") return seedSm2FromFsrs(card)
    if (from === "leitner") return seedSm2FromLeitner(card, settings.leitnerIntervals)
  }
  if (to === "leitner") {
    if (from === "sm2") return seedLeitnerFromSm2(card, settings.leitnerIntervals)
    if (from === "fsrs") return seedLeitnerFromFsrs(card, settings.leitnerIntervals)
  }
  return null
}
