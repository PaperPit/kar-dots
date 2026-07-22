// Cloudflare Pages Function: Whisper-транскрипт YouTube-аудио (бывшая Netlify background).
// POST { jobId, audioUrl, mimeType?, groqApiKey? } → 202; результат в KV (YT_JOBS).
// Опрос: GET /api/yt-video?jobId=

import { jobsStore } from './_kv.js';

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

function cleanApiKey(raw) {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{20,200}$/.test(s) ? s : '';
}

function extForMime(mimeType) {
  const m = String(mimeType || '');
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4')) return 'm4a';
  return 'audio';
}

async function saveFailed(env, jobId, errorCode, message) {
  await jobsStore(env).setJSON(jobId, {
    status: 'failed',
    errorCode,
    error: message,
    createdAt: Date.now(),
  });
}

async function runTranscription(env, payload) {
  const jobId = payload.jobId;
  const { audioUrl, mimeType } = payload;
  const apiKey = cleanApiKey(payload.groqApiKey) || cleanApiKey(env?.GROQ_API_KEY);

  if (!apiKey) {
    await saveFailed(env, jobId, 'config', 'Нет Groq API ключа — укажи его в Настройках → «Карточки из YouTube»');
    return;
  }
  if (!jobId || !audioUrl) return;

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    await saveFailed(env, jobId, 'audio-fetch-failed', 'Не удалось скачать аудиодорожку с YouTube');
    return;
  }
  const audioBuf = await audioRes.arrayBuffer();
  if (audioBuf.byteLength === 0) {
    await saveFailed(env, jobId, 'audio-fetch-failed', 'Аудиодорожка оказалась пустой');
    return;
  }
  if (audioBuf.byteLength > MAX_AUDIO_BYTES) {
    await saveFailed(env, jobId, 'audio-too-large', 'Аудиодорожка слишком большая для бесплатного распознавания');
    return;
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

  if (sttRes.status === 429) {
    await saveFailed(env, jobId, 'quota', 'Квота Groq Whisper исчерпана — попробуй позже');
    return;
  }
  if (!sttRes.ok || !sttBody) {
    await saveFailed(env, jobId, 'stt-failed', sttBody?.error?.message || 'Groq не смог распознать речь');
    return;
  }

  const segments = Array.isArray(sttBody.segments)
    ? sttBody.segments
      .map((s) => ({ t: Math.max(0, Math.round(s.start || 0)), text: String(s.text || '').trim() }))
      .filter((s) => s.text)
    : [];
  if (!segments.length) {
    await saveFailed(env, jobId, 'stt-empty', 'Не удалось распознать речь в этом видео');
    return;
  }

  await jobsStore(env).setJSON(jobId, {
    status: 'completed',
    transcript: { lang: sttBody.language || null, segments },
    createdAt: Date.now(),
  });
}

export const onRequestPost = async (ctx) => {
  let payload;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(null, { status: 202 });
  }
  ctx.waitUntil(
    runTranscription(ctx.env, payload).catch(async () => {
      if (payload?.jobId) {
        await saveFailed(ctx.env, payload.jobId, 'internal', 'Внутренняя ошибка распознавания речи');
      }
    })
  );
  return new Response(null, { status: 202 });
};
