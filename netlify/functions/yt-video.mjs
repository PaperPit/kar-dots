// Netlify Function: метаданные YouTube-видео + транскрипт через Supadata.
// POST { url }  → { video: {videoId, title, durationSec}, transcript: {lang, segments} }
//               | { pending: true, jobId, video }  (AI-расшифровка ещё идёт)
// GET  ?jobId=… → { transcript: {lang, segments} } | { pending: true, jobId }
//
// Ключ: переменная окружения SUPADATA_API_KEY (Netlify → Site settings → Environment variables).

const SUPADATA = 'https://api.supadata.ai/v1';
const MAX_DURATION_SEC = 20 * 60; // ролики строго до 20 минут

const ID_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
];

function parseVideoId(url) {
  const s = String(url || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  for (const re of ID_PATTERNS) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function err(code, message, status = 400, extra = {}) {
  return json({ error: code, message, ...extra }, status);
}

async function supadata(path, apiKey) {
  const res = await fetch(SUPADATA + path, { headers: { 'x-api-key': apiKey } });
  let body = null;
  try { body = await res.json(); } catch (e) { /* пустое тело */ }
  return { status: res.status, body };
}

/** Supadata content[] → компактные сегменты [{t: сек, text}] */
function toSegments(content) {
  if (!Array.isArray(content)) return [];
  return content
    .map(c => ({ t: Math.max(0, Math.round((c.offset || 0) / 1000)), text: String(c.text || '').trim() }))
    .filter(s => s.text);
}

function transcriptPayload(body) {
  return {
    lang: body.lang || null,
    segments: toSegments(body.content),
  };
}

export default async function handler(req) {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return err('config', 'SUPADATA_API_KEY не настроен на сервере', 500);

  // --- опрос ранее запущенной AI-расшифровки ---
  if (req.method === 'GET') {
    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!jobId || !/^[\w-]+$/.test(jobId)) return err('bad-request', 'Нет jobId');
    const { status, body } = await supadata(`/transcript/${jobId}`, apiKey);
    if (status === 200 && body && (body.status === 'completed' || body.content)) {
      if (body.status === 'failed') return err('transcript-failed', 'Не удалось расшифровать видео', 502);
      return json({ transcript: transcriptPayload(body) });
    }
    if (status === 200 || status === 202) return json({ pending: true, jobId });
    return err(body?.error || 'transcript-failed', body?.message || 'Не удалось получить транскрипт', 502);
  }

  if (req.method !== 'POST') return err('bad-request', 'Ожидается POST', 405);

  let payload;
  try { payload = await req.json(); } catch (e) { return err('bad-request', 'Неверный JSON'); }
  const videoId = parseVideoId(payload.url);
  if (!videoId) return err('bad-url', 'Не удалось распознать ссылку на YouTube-видео');

  // --- метаданные: заголовок + длительность ---
  const meta = await supadata(`/youtube/video?id=${videoId}`, apiKey);
  if (meta.status === 404) return err('not-found', 'Видео не найдено (удалено или приватное)', 404);
  if (meta.status === 401 || meta.status === 403) return err('auth', 'Проблема с ключом Supadata', 502);
  if (meta.status !== 200 || !meta.body) return err('meta-failed', 'Не удалось получить данные видео', 502);

  const durationSec = Number(meta.body.duration ?? meta.body.media?.duration ?? 0) || 0;
  const video = {
    videoId,
    title: meta.body.title || 'YouTube video',
    durationSec,
  };
  if (durationSec > MAX_DURATION_SEC) {
    const min = Math.floor(durationSec / 60);
    return err('too-long', `Видео длится ~${min} мин — можно обрабатывать ролики до 20 минут`, 400, { video });
  }

  // --- транскрипт: сначала субтитры, при их отсутствии Supadata сам делает AI-расшифровку ---
  const tr = await supadata(`/transcript?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&mode=auto&text=false`, apiKey);
  if (tr.status === 202 && tr.body?.jobId) {
    return json({ pending: true, jobId: tr.body.jobId, video });
  }
  if (tr.status === 200 && tr.body && Array.isArray(tr.body.content)) {
    return json({ video, transcript: transcriptPayload(tr.body) });
  }
  if (tr.status === 206 || tr.body?.error === 'transcript-unavailable') {
    return err('transcript-unavailable', 'У видео нет субтитров, и расшифровка недоступна', 422, { video });
  }
  if (tr.status === 429) return err('quota', 'Квота Supadata исчерпана — попробуй позже', 429);
  return err(tr.body?.error || 'transcript-failed', tr.body?.message || 'Не удалось получить транскрипт', 502);
}

export const config = { path: '/api/yt-video' };
