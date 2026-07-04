import { store, app } from '../core/state.js';
import { el, CROW_SVG } from './ui.js';
import { ICONS } from './constants.js';
import { svgNode } from './helpers.js';

let dueBadge = 0;

export function setDueBadge(n) { dueBadge = n; }

export async function refreshDueBadge() {
  if (!store) { dueBadge = 0; return 0; }
  dueBadge = await store.countDue(null);
  return dueBadge;
}

export function shell(viewName, content) {
  app.innerHTML = '';
  const badge = dueBadge > 0 ? String(dueBadge) : null;
  const tabs = [
    { id: 'home', label: 'Папки', icon: ICONS.home, hash: '#home' },
    { id: 'review', label: 'Повторение', icon: ICONS.cards, hash: '#review', badge },
    { id: 'settings', label: 'Настройки', icon: ICONS.gear, hash: '#settings' },
  ];

  const header = el('header', { class: 'header' },
    el('div', { class: 'header-in' }, [
      el('button', { class: 'brand', onclick: () => nav('#home') }, [
        svgNode(CROW_SVG),
        el('span', null, [el('span', { class: 'kar' }, 'КАР'), '-точки']),
      ]),
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

  const main = el('main', { class: 'main' }, el('div', { class: 'view' }, content));
  app.append(header, main, tabbar);
  window.scrollTo(0, 0);
}

export function nav(hash) { location.hash = hash; }

export function offlineBanner() {
  if (!store || store.kind !== 'cloud' || !store.offline) return null;
  return el('div', { class: 'offline-banner' }, 'Нет сети — изменения сохранятся локально и синхронизируются позже');
}
