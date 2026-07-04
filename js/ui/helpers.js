import { store } from '../core/state.js';
import { el, CROW_SVG } from './ui.js';

export function svgNode(svgText) {
  const d = document.createElement('div');
  d.innerHTML = svgText;
  return d.firstChild;
}

export function crowBox(cls) {
  return el('div', { class: cls || 'crow', html: CROW_SVG });
}

export function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newBudget() {
  const s = store.settings;
  let rec = { date: '', count: 0 };
  try { rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}'); } catch (e) {}
  const today = new Date().toDateString();
  if (rec.date !== today) rec = { date: today, count: 0 };
  return Math.max(0, (s.newPerDay || 20) - (rec.count || 0));
}

export function spendNewBudget() {
  const today = new Date().toDateString();
  let rec = { date: today, count: 0 };
  try {
    rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}');
    if (rec.date !== today) rec = { date: today, count: 0 };
  } catch (e) {}
  rec.count = (rec.count || 0) + 1;
  localStorage.setItem('kar_new_today', JSON.stringify(rec));
}

function stripPlain(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function textPreview(c) {
  const front = stripPlain(c.front);
  const back = stripPlain(c.back);
  const t = front + (back ? ' — ' + back : '');
  return t.length > 80 ? t.slice(0, 80) + '…' : t;
}
