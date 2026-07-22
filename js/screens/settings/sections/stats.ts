import { el, plural } from '../../../ui/ui.js';
import { loadStudyStats } from '../../../lib/stats.js';
import { reviewsPerDaySetting } from '../../../ui/study-budget.js';
import { statTile } from '../shared.js';
import { nav } from '../../../ui/navigation.js';
import type { LocalStore } from '../../../data/store-local.js';

export async function buildStatsGroup(store: LocalStore) {
  let stats = { reviewsToday: 0, dueToday: 0, dueTomorrow: 0, streak: 0 };
  try {
    stats = await loadStudyStats(store);
  } catch (e) {
    console.error('loadStudyStats', e);
  }
  // Как на главной / в очереди: не больше лимита «Повторений в день»
  const dueToday = Math.min(stats.dueToday, reviewsPerDaySetting(store.settings));
  return el('div', { class: 'settings-group stats-group' }, [
    el('h4', null, 'Статистика'),
    el('div', { class: 'stats-grid' }, [
      statTile('Повторений сегодня', stats.reviewsToday),
      statTile('К повторению сегодня', dueToday),
      statTile('Завтра', stats.dueTomorrow),
      statTile('Серия дней', `${stats.streak} ${plural(stats.streak, 'день', 'дня', 'дней')}`),
    ]),
    el('button', {
      type: 'button',
      class: 'btn ghost stats-open-btn',
      onclick: () => nav('#stats'),
    }, 'Открыть статистику →'),
  ]);
}
