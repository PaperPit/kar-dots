// Netlify Background Function: скачивает прямую аудиодорожку YouTube и распознаёт
// речь через Groq Whisper (бесплатно, см. GROQ_API_KEY в docs/youtube-import-setup.md).
// Фоновая — потому что скачивание + распознавание 20-минутного ролика может не
// уложиться в лимит обычной (синхронной) функции. Результат кладём в Netlify Blobs;
// netlify/functions/yt-video.mjs (GET ?jobId=…) его оттуда забирает.
//
// Вызывается только самой yt-video.mjs, не напрямую с фронтенда.

import { getStore } from '@netlify/blobs';

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';
const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // запас от лимита Groq free tier (25 МБ)

function jobsStore() {
  try {
    return getStore({ name: 'yt-import-jobs', consistency: 'strong' });
  } catch (e) {
    // локальная разработка (scripts/dev-server.mjs): Netlify Blobs недоступны,
    // но обе функции работают в одном процессе — хватает общего in-memory стора
    const mem = globalThis.__ytJobsMem || (globalThis.__ytJobsMem = new Map());
    return {
      async setJSON(key, value) { mem.set(key, value); },
      async get(key) { return mem.has(key) ? mem.get(key) : null; },
    };
  }
}

async function saveFailed(jobId, errorCode, message) {
  await jobsStore().setJSON(jobId, { status: 'failed', errorCode, error: message, createdAt: Date.now() });
}

function extForMime(mimeType) {
  const m = String(mimeType || '');
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4')) return 'm4a';
  return 'audio';
}

/** Ключ из payload: только разумный формат, иначе игнорируем (защита заголовка Authorization). */
function cleanApiKey(raw) {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{20,200}$/.test(s) ? s : '';
}

export default async function handler(req) {
  let jobId;
  try {
    const payload = await req.json();
    jobId = payload.jobId;
    const { audioUrl, mimeType } = payload;
    // личный ключ (проброшен из yt-video.mjs) приоритетнее серверного
    const apiKey = cleanApiKey(payload.groqApiKey) || process.env.GROQ_API_KEY;

    if (!apiKey) { await saveFailed(jobId, 'config', 'Нет Groq API ключа — укажи его в Настройках → «Карточки из YouTube»'); return new Response(null, { status: 202 }); }
    if (!jobId || !audioUrl) return new Response(null, { status: 202 });

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      await saveFailed(jobId, 'audio-fetch-failed', 'Не удалось скачать аудиодорожку с YouTube');
      return new Response(null, { status: 202 });
    }
    const audioBuf = await audioRes.arrayBuffer();
    if (audioBuf.byteLength === 0) {
      await saveFailed(jobId, 'audio-fetch-failed', 'Аудиодорожка оказалась пустой');
      return new Response(null, { status: 202 });
    }
    if (audioBuf.byteLength > MAX_AUDIO_BYTES) {
      await saveFailed(jobId, 'audio-too-large', 'Аудиодорожка слишком большая для бесплатного распознавания');
      return new Response(null, { status: 202 });
    }

    const form = new FormData();
    form.append('file', new Blob([audioBuf], { type: mimeType || 'audio/webm' }), `audio.${extForMime(mimeType)}`);
    form.append('model', MODEL);
    form.append('response_format', 'verbose_json');

    const sttRes = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    let sttBody = null;
    try { sttBody = await sttRes.json(); } catch (e) { /* пусто */ }

    if (sttRes.status === 429) { await saveFailed(jobId, 'quota', 'Квота Groq Whisper исчерпана — попробуй позже'); return new Response(null, { status: 202 }); }
    if (!sttRes.ok || !sttBody) {
      await saveFailed(jobId, 'stt-failed', sttBody?.error?.message || 'Groq не смог распознать речь');
      return new Response(null, { status: 202 });
    }

    const segments = Array.isArray(sttBody.segments)
      ? sttBody.segments
        .map(s => ({ t: Math.max(0, Math.round(s.start || 0)), text: String(s.text || '').trim() }))
        .filter(s => s.text)
      : [];
    if (!segments.length) {
      await saveFailed(jobId, 'stt-empty', 'Не удалось распознать речь в этом видео');
      return new Response(null, { status: 202 });
    }

    await jobsStore().setJSON(jobId, {
      status: 'completed',
      transcript: { lang: sttBody.language || null, segments },
      createdAt: Date.now(),
    });
  } catch (e) {
    if (jobId) await saveFailed(jobId, 'internal', 'Внутренняя ошибка распознавания речи');
  }
  return new Response(null, { status: 202 });
}

export const config = { background: true };
