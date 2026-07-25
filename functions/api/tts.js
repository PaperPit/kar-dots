// Cloudflare Pages Function: Orpheus TTS через Groq.
// POST { text, voice, groqApiKey? } → audio/wav

import { formatOrpheusError } from '../../js/lib/orpheus-tts.js';
import { cleanGroqApiKey, normalizeOrpheusVoice } from './lib/api-keys.js';

const ORPHEUS_MODEL = 'canopylabs/orpheus-v1-english';
const MAX_CHARS = 200;
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/speech';

function json(body, status = 400) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function handler(req, _env) {
  if (req.method !== 'POST') return json({ error: 'bad-request', message: 'Ожидается POST' }, 405);

  let payload;
  try { payload = await req.json(); } catch (e) { return json({ error: 'bad-request', message: 'Неверный JSON' }); }

  const text = String(payload.text || '').trim();
  if (!text) return json({ error: 'bad-request', message: 'Пустой текст' });
  if (text.length > MAX_CHARS) {
    return json({ error: 'too-long', message: `Максимум ${MAX_CHARS} символов для Orpheus` });
  }

  // Только ключ из запроса — серверный GROQ_API_KEY не используем.
  const apiKey = cleanGroqApiKey(payload.groqApiKey) || '';
  if (!apiKey) {
    return json({
      error: 'config',
      message: 'Нужен свой Groq API ключ в Настройках → «Карточки из YouTube» → «Настроить»',
    }, 401);
  }

  const voice = normalizeOrpheusVoice(payload.voice);

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
    let errBody = null;
    try { errBody = await res.json(); } catch (e) { /* не JSON */ }
    const raw = errBody?.error?.message || errBody?.message || `Groq TTS (${res.status})`;
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

export const onRequestPost = (ctx) => handler(ctx.request, ctx.env);
