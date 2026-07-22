// ============================================================
// КАР-точки — аналитика удержания и подготовка данных для оптимизатора FSRS
// Работает поверх журнала повторений (review-log). Честные измерения:
// удержание считается по фактическим исходам, без моделирования.
// ============================================================

import type { ReviewLogEntry } from "./review-log.js"
import { dayKey } from "./activity.js"

const MATURE_DAYS = 21

/** «Настоящее» повторение (не первый показ): карточка уже была изучена. */
export function isRealReview(r: ReviewLogEntry): boolean {
  return (r.state_before ?? 0) >= 2 || (r.elapsed_days ?? 0) >= 1
}

export interface AlgoRetention {
  total: number
  known: number
  retention: number | null
}

export interface RetentionStats {
  totalReviews: number
  reviewCount: number
  reviewKnown: number
  reviewRetention: number | null
  matureCount: number
  matureKnown: number
  matureRetention: number | null
  youngRetention: number | null
  firstShows: number
  uniqueCards: number
  byAlgo: Record<string, AlgoRetention>
}

export function computeRetentionStats(reviews: ReviewLogEntry[]): RetentionStats {
  const st: RetentionStats = {
    totalReviews: reviews.length,
    reviewCount: 0,
    reviewKnown: 0,
    reviewRetention: null,
    matureCount: 0,
    matureKnown: 0,
    matureRetention: null,
    youngRetention: null,
    firstShows: 0,
    uniqueCards: 0,
    byAlgo: {}
  }
  const cards = new Set<string>()
  let youngTotal = 0
  let youngKnown = 0
  for (const r of reviews) {
    if (r.card_id) cards.add(r.card_id)
    const algo = r.algo || "?"
    const a = st.byAlgo[algo] || (st.byAlgo[algo] = { total: 0, known: 0, retention: null })
    a.total++
    if (r.known) a.known++
    if (!isRealReview(r)) {
      st.firstShows++
      continue
    }
    st.reviewCount++
    if (r.known) st.reviewKnown++
    if ((r.elapsed_days ?? 0) >= MATURE_DAYS) {
      st.matureCount++
      if (r.known) st.matureKnown++
    } else {
      youngTotal++
      if (r.known) youngKnown++
    }
  }
  st.uniqueCards = cards.size
  st.reviewRetention = st.reviewCount ? st.reviewKnown / st.reviewCount : null
  st.matureRetention = st.matureCount ? st.matureKnown / st.matureCount : null
  st.youngRetention = youngTotal ? youngKnown / youngTotal : null
  for (const k of Object.keys(st.byAlgo)) {
    const a = st.byAlgo[k]!
    a.retention = a.total ? a.known / a.total : null
  }
  return st
}

export interface DayBucket {
  key: string
  label: string
  total: number
  known: number
  retention: number | null
}

/** Последние `days` календарных дней: сколько повторений и какое удержание. */
export function reviewsByDay(reviews: ReviewLogEntry[], days = 30, now = Date.now()): DayBucket[] {
  const buckets: DayBucket[] = []
  const index: Record<string, DayBucket> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    const b: DayBucket = { key, label: String(d.getDate()), total: 0, known: 0, retention: null }
    buckets.push(b)
    index[key] = b
  }
  for (const r of reviews) {
    const key = dayKey(new Date(r.ts))
    const b = index[key]
    if (!b) continue
    b.total++
    if (r.known) b.known++
  }
  for (const b of buckets) b.retention = b.total ? b.known / b.total : null
  return buckets
}

export interface RetentionAdvice {
  level: "ok" | "high" | "low" | "nodata"
  text: string
}

/** Рекомендация по желаемому удержанию исходя из измеренного. */
export function suggestRetention(stats: RetentionStats): RetentionAdvice {
  const r = stats.reviewRetention
  if (r == null || stats.reviewCount < 30) {
    return { level: "nodata", text: "Пока мало данных — оценка появится после ~30 повторений изученных карточек." }
  }
  const pct = Math.round(r * 100)
  if (r >= 0.95) {
    return { level: "high", text: `Измеренное удержание ${pct}% выше цели. Можно снизить желаемое удержание до 0.85–0.90 — интервалы вырастут, а нагрузка заметно упадёт почти без потерь.` }
  }
  if (r < 0.8) {
    return { level: "low", text: `Измеренное удержание ${pct}% ниже 80% — карточки часто забываются. Повысьте желаемое удержание ближе к 0.90 или оценивайте строже.` }
  }
  return { level: "ok", text: `Измеренное удержание ${pct}% — в здоровом диапазоне 80–95%. Менять цель не нужно.` }
}

/**
 * CSV журнала в формате, пригодном для официального оптимизатора FSRS
 * (open-spaced-repetition/fsrs-optimizer). Колонки: card_id, review_time (мс),
 * review_rating (1–4), review_state (0 new,1 learning,2 review,3 relearning).
 */
export function toOptimizerCsv(reviews: ReviewLogEntry[]): string {
  const rows = reviews
    .filter((r) => r.card_id)
    .slice()
    .sort((a, b) => (a.card_id < b.card_id ? -1 : a.card_id > b.card_id ? 1 : (a.ts || 0) - (b.ts || 0)))
  const header = "card_id,review_time,review_rating,review_state"
  const body = rows.map((r) =>
    [r.card_id, r.ts, r.rating, r.state_before ?? 0].join(",")
  )
  return [header, ...body].join("\n")
}

/** Разобрать строку весов (числа через запятую/пробел/перенос). Пусто/ошибка → null. */
export function parseWeights(text: string): number[] | null {
  const parts = String(text || "")
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (!parts.length) return null
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isFinite(n))) return null
  return nums
}

export function formatPercent(v: number | null): string {
  if (v == null) return "—"
  return Math.round(v * 100) + "%"
}
