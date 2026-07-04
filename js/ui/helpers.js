import { store } from '../core/state.js';
import { el, CROW_SVG, stripHtml } from './ui.js';
import { RAVEN_BRAND_SVG } from './raven-brand.js';

const ICON_SRC = {
  ghost: 'icons/ghost.svg',
  emptyCage: 'icons/empty%20cage.svg',
  birdCage: 'icons/Bird%20cage.svg',
  crowTomb: 'icons/The%20crow%20with%20the%20tombstone.svg',
  scarecrow: 'icons/Scarecrow.svg',
  feather: 'icons/feather.svg',
  cup: 'icons/cup.svg',
};

export function svgNode(svgText) {
  const d = document.createElement('div');
  d.innerHTML = svgText;
  return d.firstChild;
}

function iconImg(name, cls) {
  return el('img', { class: cls, src: ICON_SRC[name], alt: '', draggable: 'false' });
}

export function ghostBox() {
  return iconImg('ghost', 'auth-logo icon-float');
}

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

export function emptyFoldersBox() {
  return iconImg('emptyCage', 'empty-icon');
}

export function emptyCardsBox() {
  return iconImg('emptyCage', 'empty-icon');
}

export function scarecrowBox(cls) {
  return iconImg('scarecrow', cls || 'review-hero-icon');
}

export function featherIcon(cls) {
  return iconImg('feather', cls || 'app-icon');
}

export function crowTombIcon(cls) {
  return iconImg('crowTomb', cls || 'modal-illus-img crow-tomb-illus');
}

export function modalHead(title, icon) {
  return el('div', { class: 'modal-head' }, [icon, el('h3', { class: 'modal-title' }, title)]);
}

export function crowBox(cls) {
  return el('div', { class: cls || 'crow', html: CROW_SVG });
}

export function cupBox(cls) {
  return iconImg('cup', cls || 'trophy-drop');
}

export function trophyBox() {
  return cupBox('trophy-drop');
}

export function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

/** Короткая тактильная отдача на мобиле (если поддерживается). */
export function haptic(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {}
}

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Плавно «досчитывает» число в элементе от 0 до `to`.
 * При включённом «уменьшить движение» — просто ставит итог.
 */
export function countUp(node, to, ms) {
  to = Number(to) || 0;
  if (prefersReducedMotion() || to <= 0) { node.textContent = String(to); return; }
  ms = ms || 520;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    node.textContent = String(Math.round(eased * to));
    if (t < 1) requestAnimationFrame(tick);
    else node.textContent = String(to);
  }
  requestAnimationFrame(tick);
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

export function refundNewBudget() {
  const today = new Date().toDateString();
  let rec = { date: today, count: 0 };
  try {
    rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}');
    if (rec.date !== today) return;
  } catch (e) { return; }
  rec.count = Math.max(0, (rec.count || 0) - 1);
  localStorage.setItem('kar_new_today', JSON.stringify(rec));
}

/** Кириллица → ru-RU, латиница → en-US, иначе ru-RU. */
export function detectSpeechLang(text) {
  const t = String(text || '');
  if (/[\u0400-\u04FF]/.test(t)) return 'ru-RU';
  if (/[a-zA-Z]/.test(t)) return 'en-US';
  return 'ru-RU';
}

function pickVoice(lang) {
  const voices = speechSynthesis.getVoices();
  const prefix = lang.startsWith('en') ? 'en' : 'ru';
  const matching = voices.filter(v => v.lang.startsWith(prefix));
  return matching.find(v => /samantha|daniel|karen|alex|moira|milena|yuri|google|premium|enhanced/i.test(v.name))
    || matching.find(v => !/compact|low/i.test(v.name))
    || matching[0]
    || null;
}

function speechRate() {
  const r = store?.settings?.ttsRate;
  if (r == null || r === '') return 1;
  return Math.min(2, Math.max(0.5, Number(r) || 1));
}

function speakUtterance(text, lang, onDone) {
  const u = new SpeechSynthesisUtterance(text);
  const resolved = lang || detectSpeechLang(text);
  u.lang = resolved;
  u.rate = speechRate();
  const voice = pickVoice(resolved);
  if (voice) u.voice = voice;
  if (onDone) {
    u.onend = onDone;
    u.onerror = onDone;
  }
  speechSynthesis.speak(u);
}

/** Озвучка текста (Web Speech API). Язык — по алфавиту, если не передан. */
export function speakText(text, lang) {
  if (!text?.trim() || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  speakUtterance(text.trim(), lang);
}

/** Несколько фрагментов подряд — у каждого свой язык по алфавиту. */
export function speakSequence(texts) {
  if (typeof speechSynthesis === 'undefined') return;
  const queue = (Array.isArray(texts) ? texts : [texts])
    .map(t => String(t || '').trim())
    .filter(Boolean);
  if (!queue.length) return;
  speechSynthesis.cancel();
  let i = 0;
  function next() {
    if (i >= queue.length) return;
    speakUtterance(queue[i++], null, next);
  }
  next();
}

/** Озвучить лицо или оборот карточки (определение + описание). */
export function speakCardSide(card, side) {
  const parts = [];
  if (side === 'front') {
    const t = stripHtml(card.front);
    if (t) parts.push(t);
  } else {
    const b = stripHtml(card.back);
    if (b) parts.push(b);
    const d = stripHtml(card.description || '');
    if (d) parts.push(d);
  }
  if (!parts.length) return false;
  speakSequence(parts);
  return true;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', () => {});
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
