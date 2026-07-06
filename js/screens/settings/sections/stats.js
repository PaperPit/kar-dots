import { el, plural } from '../../../ui/ui.js';
import { loadStudyStats } from '../../../lib/stats.js';
import { statTile } from '../shared.js';

export async function buildStatsGroup(store) {
  let stats = { reviewsToday: 0, dueToday: 0, dueTomorrow: 0, streak: 0 };
  try {
    stats = await loadStudyStats(store);
  } catch (e) {
    console.error('loadStudyStats', e);
  }
  return el('div', { class: 'settings-group stats-group' }, [
    el('h4', null, 'Статистика'),
    el('div', { class: 'stats-grid' }, [
      statTile('Повторений сегодня', stats.reviewsToday),
      statTile('К повторению сегодня', stats.dueToday),
      statTile('Завтра', stats.dueTomorrow),
      statTile('Серия дней', `${stats.streak} ${plural(stats.streak, 'день', 'дня', 'дней')}`),
    ]),
  ]);
}
