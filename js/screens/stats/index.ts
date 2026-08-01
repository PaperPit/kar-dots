import { store } from '../../core/state.js';
import { el } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { initActivity, loadActivity, calcVisitStreak } from '../../lib/activity.js';
import { initReviewLog, getAllReviews } from '../../lib/review-log.js';
import {
  computeRetentionStats,
  reviewsByDay,
  suggestRetention,
  formatPercent,
  type RetentionAdvice,
} from '../../lib/fsrs-optimize.js';
import { barChart, type Bar } from '../../lib/charts.js';
import * as SRS from '../../lib/srs.js';
import type { SrsRow, Algo } from '../../lib/srs.js';
import type { ReviewLogEntry } from '../../lib/review-log.js';
import { t, localeTag } from '../../lib/i18n.js';

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

function formatRetentionAdvice(adv: RetentionAdvice, reviewRetention: number | null): string {
  if (adv.level === 'nodata') return t('stats.advice.nodata');
  const pct = reviewRetention != null ? Math.round(reviewRetention * 100) : 0;
  if (adv.level === 'high') return t('stats.advice.high', { pct });
  if (adv.level === 'low') return t('stats.advice.low', { pct });
  return t('stats.advice.ok', { pct });
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
    const label = i === 0 ? t('stats.forecast.today') : String(dt.getDate());
    bars.push({
      label,
      value: count,
      title: t('stats.forecast.barTitle', {
        date: dt.toLocaleDateString(localeTag()),
        count,
      }),
      accent: i === 0,
    });
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
  const nameOf = (id: string) => folders.find((f) => f.id === id)?.name || t('stats.folders.none');
  const rows = Object.keys(per)
    .map((id) => ({ id, ...per[id]! }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  if (!rows.length) return el('p', { class: 'muted' }, t('stats.folders.empty'));
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
    tile(t('stats.tile.totalReviews'), String(stats.totalReviews)),
    tile(t('stats.tile.uniqueCards'), String(stats.uniqueCards)),
    tile(t('stats.tile.streak'), String(streak)),
    tile(
      t('stats.tile.retention'),
      formatPercent(stats.reviewRetention),
      stats.reviewCount
        ? t('stats.tile.retentionSub', { n: stats.reviewCount })
        : t('stats.tile.noData'),
    ),
    tile(
      t('stats.tile.mature'),
      formatPercent(stats.matureRetention),
      stats.matureCount ? t('stats.tile.matureSub', { n: stats.matureCount }) : '—',
    ),
  ]);

  const empty = reviews.length === 0
    ? el('div', { class: 'settings-group' }, [
        el('p', { class: 'muted' }, t('stats.empty')),
      ])
    : null;

  const retentionBlock = section(t('stats.section.retention'),
    el('div', { class: 'retention-head' }, [
      el('div', { class: 'retention-big tnum' }, formatPercent(stats.reviewRetention)),
      el('div', { class: 'retention-advice' }, formatRetentionAdvice(advice, stats.reviewRetention)),
    ]),
    Object.keys(stats.byAlgo).length > 1
      ? el('div', { class: 'retention-by-algo muted' }, Object.keys(stats.byAlgo).map((k) =>
          el('span', null, k.toUpperCase() + ': ' + formatPercent(stats.byAlgo[k]!.retention))
        ))
      : null,
  );

  const content = el('div', null, [
    // Экран читает журнал из облака — предупреждение об офлайне здесь нужно.
    offlineBanner(),
    el('div', { class: 'page-head' }, [
      el('h2', { class: 'page-title' }, t('stats.title')),
    ]),
    tiles,
    empty,
    reviews.length
      ? section(
          t('stats.section.reviews30'),
          barChart(byDay.map((d) => ({ label: d.label, value: d.total, title: d.key + ': ' + d.total }))),
        )
      : null,
    reviews.length ? retentionBlock : null,
    section(t('stats.section.forecast'),
      el('p', { class: 'muted stats-hint' }, t('stats.forecast.hint', { algo: algo.toUpperCase() })),
      barChart(forecast),
    ),
    reviews.length ? section(t('stats.section.folders'), folderBreakdown(reviews, folders)) : null,
    el(
      'p',
      { class: 'muted settings-footer' },
      t('stats.footer') +
        (typeof store?.syncReviewLogFromCloud === 'function' ? t('stats.footerCloud') : ''),
    ),
  ]);

  shell('stats', content);
}
