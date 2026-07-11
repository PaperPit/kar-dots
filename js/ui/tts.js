import { store } from '../core/state.js';
import { stripHtml, toast } from './ui.js';
import {
  detectSpeechLang,
  resolveSpeechVoice,
  waitForSpeechVoices,
  getSpeechVoices,
  clampSpeechRate,
  speechSynthesisSupported,
} from '../lib/web-speech-tts.js';

export { detectSpeechLang } from '../lib/web-speech-tts.js';

let speakSession = 0;

export function stopAllSpeech() {
  speakSession += 1;
  if (speechSynthesisSupported()) speechSynthesis.cancel();
}

function voiceUriForLang(settings, lang) {
  const en = String(lang || '').toLowerCase().startsWith('en');
  return en ? (settings?.ttsVoiceEn || '') : (settings?.ttsVoiceRu || '');
}

function speechRate(settings) {
  return clampSpeechRate(settings?.ttsRate);
}

function speakUtteranceAsync(text, lang, settings, session) {
  return new Promise(resolve => {
    if (session !== speakSession || !speechSynthesisSupported()) {
      resolve();
      return;
    }
    const resolved = lang || detectSpeechLang(text);
    const voices = getSpeechVoices();
    const voice = resolveSpeechVoice(voices, resolved, voiceUriForLang(settings, resolved));
    const u = new SpeechSynthesisUtterance(text);
    u.lang = resolved;
    u.rate = speechRate(settings);
    if (voice) u.voice = voice;
    const done = () => {
      if (session === speakSession) resolve();
    };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  });
}

async function speakOne(text, lang, settings) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  if (!speechSynthesisSupported()) {
    toast('Озвучка недоступна в этом браузере', 'error');
    return;
  }
  stopAllSpeech();
  const session = speakSession;
  await waitForSpeechVoices();
  if (session !== speakSession) return;
  await speakUtteranceAsync(trimmed, lang, settings, session);
}

/**
 * @param {string} text
 * @param {string} [lang]
 */
export async function speakText(text, lang) {
  if (!text?.trim()) return;
  const settings = store?.settings || {};
  await speakOne(text, lang, settings);
}

export async function speakSequence(texts) {
  const queue = (Array.isArray(texts) ? texts : [texts])
    .map(t => String(t || '').trim())
    .filter(Boolean);
  for (const t of queue) {
    await speakText(t);
  }
}

export async function speakCardSide(card, side) {
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
  await speakSequence(parts);
  return true;
}

/** Прослушать выбранный системный голос в настройках. */
export async function previewSpeechVoice(lang) {
  const sample = String(lang || '').toLowerCase().startsWith('en') ? 'Hello' : 'Привет';
  await speakText(sample, lang);
}
