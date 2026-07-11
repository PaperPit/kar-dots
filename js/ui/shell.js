import { store, app } from '../core/state.js';
import { el } from './ui.js';
import { ICONS } from './constants.js';
import { brandMark, svgNode } from './helpers.js';
import { nav } from './navigation.js';
import { syncRavenEggScreen, tryRavenEggClick } from '../lib/raven-easter-egg.js';
import { animateViewIn, staggerIn } from '../lib/motion-ui.js';
import { createThemeToggle } from './theme-toggle.js';

async function openStudyModePicker() {
  const { studyModePicker } = await import('../screens/review/mode-picker.js');
  studyModePicker({});
}

let dueBadge = 0;

export function setDueBadge(n) { dueBadge = n; }

export async function refreshDueBadge() {
  if (!store) { dueBadge = 0; return 0; }
  dueBadge = await store.countDue(null);
  return dueBadge;
}

export function shell(viewName, content, prependToMain) {
  syncRavenEggScreen(viewName);
  app.innerHTML = '';
  const badge = dueBadge > 0 ? String(dueBadge) : null;
  const tabs = [
    { id: 'home', label: 'Папки', icon: ICONS.home, hash: '#home' },
    {
      id: 'review', label: 'Повторение', icon: ICONS.cards,
      onclick: () => openStudyModePicker(),
      hash: '#review',
      badge,
    },
    { id: 'settings', label: 'Настройки', icon: ICONS.gear, hash: '#settings' },
  ];

  const header = el('header', { class: 'header' },
    el('div', { class: 'header-in' }, [
      brandMark({
        onclick: () => {
          if (viewName === 'home' && tryRavenEggClick()) return;
          nav('#home');
        },
      }),
      el('div', { class: 'header-actions' }, [
        el('nav', { class: 'nav-desktop' }, tabs.map(t =>
          el('button', {
            class: 'nav-btn' + (viewName === t.id ? ' active' : ''),
            onclick: () => (t.onclick ? t.onclick() : nav(t.hash)),
          }, [t.label, t.badge ? el('span', { class: 'badge' }, t.badge) : null])
        )),
        createThemeToggle(),
      ]),
    ])
  );

  const tabbar = el('div', { class: 'tabbar' }, tabs.map(t =>
    el('button', {
      class: 'tab-btn' + (viewName === t.id ? ' active' : ''),
      onclick: () => (t.onclick ? t.onclick() : nav(t.hash)),
    }, [svgNode(t.icon), el('span', null, t.label), t.badge ? el('span', { class: 'badge' }, t.badge) : null])
  ));

  const view = el('div', { class: 'view' }, content);
  const mainKids = prependToMain ? [prependToMain, view] : [view];
  const main = el('main', { class: 'main' }, mainKids);
  app.append(header, main, tabbar);
  main.scrollTop = 0;
  requestAnimationFrame(() => {
    animateViewIn(view);
    staggerIn(view);
  });
}

export { nav } from './navigation.js';

export function offlineBanner() {
  if (!store || store.kind !== 'cloud' || !store.offline) return null;
  return el('div', { class: 'offline-banner' }, 'Нет сети — изменения сохранятся локально и синхронизируются позже');
}
