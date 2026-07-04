import { store, app } from '../core/state.js';
import { el } from './ui.js';
import { ICONS } from './constants.js';
import { brandMark, svgNode } from './helpers.js';

let dueBadge = 0;

export function setDueBadge(n) { dueBadge = n; }

export async function refreshDueBadge() {
  if (!store) { dueBadge = 0; return 0; }
  dueBadge = await store.countDue(null);
  return dueBadge;
}

export function shell(viewName, content, prependToMain) {
  app.innerHTML = '';
  const badge = dueBadge > 0 ? String(dueBadge) : null;
  const tabs = [
    { id: 'home', label: 'Папки', icon: ICONS.home, hash: '#home' },
    { id: 'review', label: 'Повторение', icon: ICONS.cards, hash: '#review', badge },
    { id: 'settings', label: 'Настройки', icon: ICONS.gear, hash: '#settings' },
  ];

  const header = el('header', { class: 'header' },
    el('div', { class: 'header-in' }, [
      brandMark({ onclick: () => nav('#home') }),
      el('nav', { class: 'nav-desktop' }, tabs.map(t =>
        el('button', {
          class: 'nav-btn' + (viewName === t.id ? ' active' : ''),
          onclick: () => nav(t.hash),
        }, [t.label, t.badge ? el('span', { class: 'badge' }, t.badge) : null])
      )),
    ])
  );

  const tabbar = el('div', { class: 'tabbar' }, tabs.map(t =>
    el('button', {
      class: 'tab-btn' + (viewName === t.id ? ' active' : ''),
      onclick: () => nav(t.hash),
    }, [svgNode(t.icon), el('span', null, t.label), t.badge ? el('span', { class: 'badge' }, t.badge) : null])
  ));

  const view = el('div', { class: 'view' }, content);
  const mainKids = prependToMain ? [prependToMain, view] : [view];
  const main = el('main', { class: 'main' }, mainKids);
  app.append(header, main, tabbar);
  main.scrollTop = 0;
}

export function nav(hash) { location.hash = hash; }

export function offlineBanner() {
  if (!store || store.kind !== 'cloud' || !store.offline) return null;
  return el('div', { class: 'offline-banner' }, 'Нет сети — изменения сохранятся локально и синхронизируются позже');
}
