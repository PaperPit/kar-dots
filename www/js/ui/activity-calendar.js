import { el, plural } from './ui.js';
import { store } from '../core/state.js';
import {
  loadActivity, calcVisitStreak, getMonthGrid, dayKey, MONTH_NAMES, WEEKDAY_NAMES,
} from '../lib/activity.js';

function streakRing(streak, sm) {
  const ringDays = Math.max(1, Number(store?.settings?.streakRingDays) || 21);
  const deg = streak <= 0 ? 0 : Math.min(360, (streak / ringDays) * 360);
  return el('div', {
    class: 'streak-ring' + (sm ? ' streak-ring-sm' : ''),
    style: { '--ring-deg': deg + 'deg' },
  }, el('img', { class: 'streak-cup', src: 'icons/cup.svg', alt: '', draggable: 'false' }));
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
      streakRing(streak),
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

/** Календарь на главной: на мобиле — компактная полоска с раскрытием, на десктопе — боковая панель. */
export function homeCalendarWidget(place) {
  const aside = el('aside', {
    class: 'home-sidebar home-sidebar-' + place + ' home-sidebar-collapsible',
  });

  let open = false;
  const panel = activityPanel({ sidebar: true });
  const expand = el('div', { class: 'home-sidebar-expand' }, panel);

  const toggle = el('button', {
    type: 'button',
    class: 'home-sidebar-toggle',
    'aria-expanded': 'false',
    'aria-label': 'Открыть календарь активности',
  });

  function refreshStrip() {
    const data = loadActivity();
    const streak = calcVisitStreak(data);
    const now = new Date();
    const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    toggle.replaceChildren(
      streakRing(streak, true),
      el('div', { class: 'home-sidebar-strip-text' }, [
        el('span', { class: 'home-sidebar-strip-streak' },
          `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд`),
        el('span', { class: 'home-sidebar-strip-month' }, monthLabel),
      ]),
      el('span', { class: 'home-sidebar-chevron', 'aria-hidden': 'true' }),
    );
  }

  toggle.addEventListener('click', () => {
    open = !open;
    aside.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Свернуть календарь' : 'Открыть календарь активности');
  });

  aside.append(toggle, expand);
  refreshStrip();
  return aside;
}
