import { route } from '../core/router.js';
import { el } from './ui.js';
import { ICONS } from './constants.js';
import { svgNode } from './icons.js';

let navFallbackTimer = null;
let navFallbackSeq = 0;

/** Отменить отложенный fallback после срабатывания hashchange. */
export function cancelNavFallback() {
  navFallbackSeq += 1;
  if (navFallbackTimer) {
    clearTimeout(navFallbackTimer);
    navFallbackTimer = null;
  }
}

export function nav(hash) {
  const target = hash.startsWith('#') ? hash : '#' + hash;
  if (location.hash === target) {
    route().catch(console.error);
    return;
  }
  const seq = ++navFallbackSeq;
  location.hash = target;
  navFallbackTimer = setTimeout(() => {
    navFallbackTimer = null;
    if (seq === navFallbackSeq) route().catch(console.error);
  }, 150);
}

export function backBtn(hash = '#home', label = 'Назад') {
  return el('button', {
    type: 'button',
    class: 'icon-btn back-btn',
    'aria-label': label,
    onclick: () => nav(hash),
  }, svgNode(ICONS.back));
}
