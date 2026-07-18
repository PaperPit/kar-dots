import { loadActivity, calcVisitStreak, dayKey } from "./activity.js"
import type { LocalStore } from "../data/store-local.js"

/** Сводка для экрана настроек. */
export async function loadStudyStats(store: LocalStore) {
  const activity = loadActivity()
  let dueToday = 0
  let dueTomorrow = 0

  try {
    const stats = await store.getHomeStats()
    dueToday = stats.dueAll
    dueTomorrow = stats.dueTomorrowAll || 0
  } catch (e) {
    console.warn("loadStudyStats failed", e)
  }

  return {
    reviewsToday: activity.days[dayKey()]?.reviews || 0,
    dueToday,
    dueTomorrow,
    streak: calcVisitStreak(activity)
  }
}
