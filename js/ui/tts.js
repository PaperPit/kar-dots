import { store } from '../core/state.js';
import { stripHtml } from './ui.js';

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

export function speakText(text, lang) {
  if (!text?.trim() || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  speakUtterance(text.trim(), lang);
}

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
