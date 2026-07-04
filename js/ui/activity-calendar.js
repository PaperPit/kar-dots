import { el, plural } from './ui.js';
import {
  loadActivity, calcVisitStreak, getMonthGrid, dayKey, MONTH_NAMES, WEEKDAY_NAMES,
} from '../lib/activity.js';

function streakCup() {
  return el('img', { class: 'streak-cup', src: 'icons/cup.svg', alt: '', draggable: 'false' });
}

export function activityPanel(opts = {}) {
  const { sidebar = false, compact = false } = opts;
  const mod = sidebar ? ' sidebar' : compact ? ' compact' : '';
  const wrap = el('div', { class: 'activity-panel' + mod });
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  const todayK = dayKey();

  function render() {
    const data = loadActivity();
    const streak = calcVisitStreak(data);
    wrap.innerHTML = '';

    const streakRow = el('div', { class: 'streak-row' }, [
      streakCup(),
      el('div', { class: 'streak-text' }, [
        el('div', { class: 'streak-num' }, String(streak)),
        el('div', { class: 'streak-label' }, plural(streak, 'день подряд', 'дня подряд', 'дней подряд')),
        compact || sidebar ? null : el('div', { class: 'streak-hint muted' }, 'Заходите каждый день — серия растёт'),
      ]),
    ]);

    const nav = el('div', { class: 'cal-nav' }, [
      el('button', {
        class: 'icon-btn cal-arrow',
        title: 'Предыдущий месяц',
        onclick: () => {
          if (viewMonth === 0) { viewYear--; viewMonth = 11; }
          else viewMonth--;
          render();
        },
      }, '‹'),
      el('span', { class: 'cal-title' }, `${MONTH_NAMES[viewMonth]} ${viewYear}`),
      el('button', {
        class: 'icon-btn cal-arrow',
        title: 'Следующий месяц',
        onclick: () => {
          if (viewMonth === 11) { viewYear++; viewMonth = 0; }
          else viewMonth++;
          render();
        },
      }, '›'),
    ]);

    const weekdays = el('div', { class: 'cal-weekdays' },
      WEEKDAY_NAMES.map(w => el('span', null, w))
    );

    const grid = el('div', { class: 'cal-grid' });
    getMonthGrid(viewYear, viewMonth).forEach(cell => {
      const info = data.days[cell.key];
      const cls = ['cal-day'];
      if (cell.outside) cls.push('outside');
      if (cell.key === todayK) cls.push('today');
      if (info?.visit) cls.push('visit');
      if (info?.reviews) cls.push('review');
      grid.append(el('div', { class: cls.join(' '), title: cellTitle(info) }, String(cell.day)));
    });

    wrap.append(streakRow, nav, weekdays, grid);
  }

  function cellTitle(info) {
    if (!info) return '';
    const parts = [];
    if (info.visit) parts.push('Заход в приложение');
    if (info.reviews) parts.push(`Повторено карточек: ${info.reviews}`);
    return parts.join('. ');
  }

  render();
  return wrap;
}
