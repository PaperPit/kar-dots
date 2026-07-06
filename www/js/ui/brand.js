import { el } from './ui.js';
import { RAVEN_BRAND_SVG } from './raven-brand.js';
import { svgNode } from './icons.js';

function brandLogo() {
  const svg = svgNode(RAVEN_BRAND_SVG);
  svg.classList.add('brand-logo');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

export function brandMark(opts = {}) {
  const { heading = false, onclick } = opts;
  const nameEl = heading
    ? el('h1', { class: 'auth-title brand-name' }, [el('span', { class: 'kar' }, 'КАР'), '-точки'])
    : el('span', { class: 'brand-name' }, [el('span', { class: 'kar' }, 'КАР'), '-точки']);
  const kids = [brandLogo(), nameEl];
  if (onclick != null) return el('button', { class: 'brand', onclick }, kids);
  return el('div', { class: 'brand auth-brand' }, kids);
}

export function modalHead(title, icon) {
  return el('div', { class: 'modal-head' }, [icon, el('h3', { class: 'modal-title' }, title)]);
}
