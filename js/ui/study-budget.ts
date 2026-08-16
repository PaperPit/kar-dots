import { store } from "../core/state.js"
import { loadActivity, dayKey, scheduledReviews } from "../lib/activity.js"
import type { Settings } from "../data/types.js"

export function newBudget() {
  const s = store.settings
  let rec = { date: "", count: 0 }
  try {
    rec = JSON.parse(localStorage.getItem("kar_new_today") || "{}")
  } catch (e) { console.warn('[kar] newBudget parse failed:', e); }
  const today = new Date().toDateString()
  if (rec.date !== today) rec = { date: today, count: 0 }
  return Math.max(0, (s.newPerDay || 20) - (rec.count || 0))
}

export function spendNewBudget() {
  const today = new Date().toDateString()
  let rec = { date: today, count: 0 }
  try {
    rec = JSON.parse(localStorage.getItem("kar_new_today") || "{}")
    if (rec.date !== today) rec = { date: today, count: 0 }
  } catch (e) { console.warn('[kar] spendNewBudget parse failed:', e); }
  rec.count = (rec.count || 0) + 1
  localStorage.setItem("kar_new_today", JSON.stringify(rec))
}

export function refundNewBudget() {
  const today = new Date().toDateString()
  let rec = { date: today, count: 0 }
  try {
    rec = JSON.parse(localStorage.getItem("kar_new_today") || "{}")
    if (rec.date !== today) return
  } catch (e) {
    console.warn('[kar] refundNewBudget parse failed:', e);
    return
  }
  rec.count = Math.max(0, (rec.count || 0) - 1)
  localStorage.setItem("kar_new_today", JSON.stringify(rec))
}

/** Лимит оценок в день из настроек (минимум 1, fallback 50). */
export function reviewsPerDaySetting(settings?: Settings | null): number {
  const s = settings ?? store?.settings
  const n = Number(s?.reviewsPerDay)
  return Math.max(1, Number.isFinite(n) && n > 0 ? Math.floor(n) : 50)
}

/**
 * Сколько плановых оценок уже сделано сегодня (из activity).
 * Закрепление (cram) исключено: это практика сверх плана, и она не должна
 * выбирать дневной лимит — иначе после закрепления папки обычное повторение
 * упирается в лимит и не запускается.
 */
export function reviewsTodayCount(): number {
  return scheduledReviews(loadActivity().days[dayKey()])
}

/** Сколько оценок ещё можно сделать сегодня. */
export function reviewsBudget(settings?: Settings | null): number {
  return Math.max(0, reviewsPerDaySetting(settings) - reviewsTodayCount())
}
