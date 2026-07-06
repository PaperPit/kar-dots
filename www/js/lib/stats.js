import * as SRS from './srs.js';
import { loadActivity, calcVisitStreak, dayKey } from './activity.js';

/** Сводка для экрана настроек. */
export async function loadStudyStats(store) {
  const algo = store.settings.algo;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { start: tStart, end: tEnd } = SRS.dayBounds(tomorrow);

  let dueToday = 0;
  let dueTomorrow = 0;
  try {
    dueToday = await store.countDue(null, algo);
  } catch (e) {
    console.warn('countDue failed', e);
  }
  try {
    if (typeof store.countDueBetween === 'function') {
      dueTomorrow = await store.countDueBetween(null, algo, tStart, tEnd);
    }
  } catch (e) {
    console.warn('countDueBetween failed', e);
  }

  const activity = loadActivity();
  return {
    reviewsToday: activity.days[dayKey()]?.reviews || 0,
    dueToday,
    dueTomorrow,
    streak: calcVisitStreak(activity),
  };
}
