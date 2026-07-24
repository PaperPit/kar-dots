import { store } from '../../core/state.js';
import { el } from '../../ui/ui.js';
import { shell } from '../../ui/shell.js';
import { initActivity, loadActivity, calcVisitStreak } from '../../lib/activity.js';
import { initReviewLog, getAllReviews } from '../../lib/review-log.js';
import {
  computeRetentionStats,
  reviewsByDay,
  suggestRetention,
  formatPercent,
} from '../../lib/fsrs-optimize.js';
import { barChart, type Bar } from '../../lib/charts.js';
import * as SRS from '../../lib/srs.js';
import type { SrsRow, Algo } from '../../lib/srs.js';
import type { ReviewLogEntry } from '../../lib/review-log.js';

function tile(label: string, value: string, sub?: string): HTMLElement {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'stat-card-val tnum' }, value),
    el('div', { class: 'stat-card-lab' }, label),
    sub ? el('div', { class: 'stat-card-sub muted' }, sub) : null,
  ]);
}

function section(title: string, ...kids: (HTMLElement | null)[]): HTMLElement {
  return el('div', { class: 'settings-group stats-section' }, [
    el('h4', null, title),
    ...kids,
  ]);
}

/** Прогноз нагрузки: сколько карточек «прилетит» на повтор в ближайшие дни. */
function buildForecast(rows: SrsRow[], algo: Algo, days: number, now = Date.now()): Bar[] {
  const today0 = SRS.dayBounds(new Date(now)).start;
  const bars: Bar[] = [];
  const dues: number[] = [];
  for (const r of rows) {
    const d = SRS.dueOf(r, algo);
    if (d != null) dues.push(d);
  }
  for (let i = 0; i < days; i++) {
    const start = today0 + i * SRS.DAY;
    const end = start + SRS.DAY - 1;
    let count = 0;
    for (const d of dues) {
      if (i === 0 ? d <= end : d >= start && d <= end) count++;
    }
    const dt = new Date(start);
    const label = i === 0 ? 'сегодня' : String(dt.getDate());
    bars.push({ label, value: count, title: dt.toLocaleDateString('ru-RU') + ': ' + count + ' к повтору', accent: i === 0 });
  }
  return bars;
}

function folderBreakdown(reviews: ReviewLogEntry[], folders: { id: string; name: string }[]): HTMLElement {
  const per: Record<string, { total: number; known: number }> = {};
  for (const r of reviews) {
    const f = r.folder_id || '?';
    const o = per[f] || (per[f] = { total: 0, known: 0 });
    o.total++;
    if (r.known) o.known++;
  }
  const nameOf = (id: string) => folders.find((f) => f.id === id)?.name || 'Без папки';
  const rows = Object.keys(per)
    .map((id) => ({ id, ...per[id]! }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  if (!rows.length) return el('p', { class: 'muted' }, 'Пока нет данных по папкам.');
  return el('div', { class: 'stats-folders' }, rows.map((row) =>
    el('div', { class: 'stats-folder-row' }, [
      el('span', { class: 'stats-folder-name' }, nameOf(row.id)),
      el('span', { class: 'stats-folder-num tnum' }, String(row.total)),
      el('span', { class: 'stats-folder-ret tnum' }, formatPercent(row.total ? row.known / row.total : null)),
    ])
  ));
}

export async function renderStats(): Promise<void> {
  await Promise.all([initActivity(), initReviewLog()]);
  try {
    if (store && typeof store.syncReviewLogFromCloud === 'function') await store.syncReviewLogFromCloud();
  } catch (e) { /* офлайн — покажем локальные данные */ }

  const reviews = await getAllReviews();
  const activity = loadActivity();
  const streak = calcVisitStreak(activity);
  const stats = computeRetentionStats(reviews);
  const advice = suggestRetention(stats);
  const byDay = reviewsByDay(reviews, 30);
  const algo = (store?.settings?.algo || 'sm2') as Algo;
  const srsRows: SrsRow[] = typeof store?.getAllSrsRows === 'function' ? store.getAllSrsRows() : [];
  const forecast = buildForecast(srsRows, algo, 14);
  const folders = store?.folders || [];

  const tiles = el('div', { class: 'stats-grid' }, [
    tile('Всего повторений', String(stats.totalReviews)),
    tile('Изучается карточек', String(stats.uniqueCards)),
    tile('Серия дней', String(streak)),
    tile('Удержание', formatPercent(stats.reviewRetention), stats.reviewCount ? 'по ' + stats.reviewCount + ' повт.' : 'нет данных'),
    tile('Зрелые (≥21д)', formatPercent(stats.matureRetention), stats.matureCount ? stats.matureCount + ' карт.' : '—'),
  ]);

  const empty = reviews.length === 0
    ? el('div', { class: 'settings-group' }, [
        el('p', { class: 'muted' }, 'Журнал повторений только начал заполняться. Пройдите первую сессию повторения — и здесь появятся кривые удержания и разбивка по папкам. Прогноз нагрузки ниже уже работает по датам карточек.'),
      ])
    : null;

  const retentionBlock = section('Удержание',
    el('div', { class: 'retention-head' }, [
      el('div', { class: 'retention-big tnum' }, formatPercent(stats.reviewRetention)),
      el('div', { class: 'retention-advice' }, advice.text),
    ]),
    Object.keys(stats.byAlgo).length > 1
      ? el('div', { class: 'retention-by-algo muted' }, Object.keys(stats.byAlgo).map((k) =>
          el('span', null, k.toUpperCase() + ': ' + formatPercent(stats.byAlgo[k]!.retention))
        ))
      : null,
  );

  const content = el('div', null, [
    el('div', { class: 'page-head' }, [
      el('h2', { class: 'page-title' }, 'Статистика'),
    ]),
    tiles,
    empty,
    reviews.length ? section('Повторения за 30 дней', barChart(byDay.map((d) => ({ label: d.label, value: d.total, title: d.key + ': ' + d.total })))) : null,
    reviews.length ? retentionBlock : null,
    section('Прогноз нагрузки (14 дней)',
      el('p', { class: 'muted stats-hint' }, 'Сколько карточек станут доступны для повтора по текущему алгоритму (' + algo.toUpperCase() + ').'),
      barChart(forecast),
    ),
    reviews.length ? section('По папкам', folderBreakdown(reviews, folders)) : null,
    el('p', { class: 'muted settings-footer' }, 'КАР-точки · статистика ведётся локально' + (typeof store?.syncReviewLogFromCloud === 'function' ? ' и синхронизируется с облаком' : '')),
  ]);

  shell('stats', content);
}
