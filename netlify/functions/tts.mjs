// Netlify Function: Orpheus TTS через Groq (canopylabs/orpheus-v1-english).
// POST { text, voice, groqApiKey? } → audio/wav
//
// Личный groqApiKey из настроек приоритетнее GROQ_API_KEY из env.

import { formatOrpheusError } from '../../js/lib/orpheus-tts.js';

const ORPHEUS_MODEL = 'canopylabs/orpheus-v1-english';
const MAX_CHARS = 200;
const VOICES = new Set(['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy']);
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/speech';

function cleanApiKey(raw) {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{20,200}$/.test(s) ? s : '';
}

function json(body, status = 400) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function normalizeVoice(v) {
  const id = String(v || 'hannah').trim().toLowerCase();
  return VOICES.has(id) ? id : 'hannah';
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'bad-request', message: 'Ожидается POST' }, 405);

  let payload;
  try { payload = await req.json(); } catch (e) { return json({ error: 'bad-request', message: 'Неверный JSON' }); }

  const text = String(payload.text || '').trim();
  if (!text) return json({ error: 'bad-request', message: 'Пустой текст' });
  if (text.length > MAX_CHARS) {
    return json({ error: 'too-long', message: `Максимум ${MAX_CHARS} символов для Orpheus` });
  }

  const apiKey = cleanApiKey(payload.groqApiKey) || process.env.GROQ_API_KEY || '';
  if (!apiKey) {
    return json({ error: 'config', message: 'Нужен Groq API ключ (Настройки → Карточки из YouTube)' }, 401);
  }

  const voice = normalizeVoice(payload.voice);

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ORPHEUS_MODEL,
        input: text,
        voice,
        response_format: 'wav',
      }),
    });
  } catch (e) {
    return json({ error: 'network', message: 'Не удалось связаться с Groq' }, 502);
  }

  if (!res.ok) {
    let err = null;
    try { err = await res.json(); } catch (e) { /* не JSON */ }
    const raw = err?.error?.message || err?.message || `Groq TTS (${res.status})`;
    const code = /terms acceptance|accept the terms/i.test(raw)
      ? 'terms-required'
      : res.status === 429 ? 'quota' : res.status === 401 ? 'unauthorized' : 'tts-failed';
    return json({ error: code, message: formatOrpheusError(raw), voice }, res.status >= 400 ? res.status : 502);
  }

  const wav = await res.arrayBuffer();
  return new Response(wav, {
    status: 200,
    headers: {
      'content-type': 'audio/wav',
      'cache-control': 'private, max-age=86400',
      'x-orpheus-voice': voice,
    },
  });
}

export const config = { path: '/api/tts' };
