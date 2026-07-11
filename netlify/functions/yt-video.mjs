// Netlify Function: метаданные YouTube-видео + транскрипт — БЕЗ сторонних сервисов.
// POST { url }  → { video: {videoId, title, durationSec}, transcript: {lang, segments} }
//               | { pending: true, jobId, video }  (нет субтитров — идёт распознавание речи)
// GET  ?jobId=… → { transcript: {lang, segments} } | { pending: true, jobId } | ошибка
//
// Как это работает (нет ни одного стороннего API-ключа для этой функции):
//  1. Скачиваем страницу watch?v=… и достаём из неё свежий INNERTUBE_API_KEY —
//     он перевыпускается Google время от времени, поэтому берём его каждый раз заново,
//     а не храним захардкоженным (так стабильнее).
//  2. Дёргаем внутренний плеер-эндпоинт YouTube (youtubei/v1/player) под видом
//     Android-клиента — так получаем и метаданные, и список субтитров, и (иногда)
//     прямые несжатые ссылки на аудиодорожку без цифровой подписи.
//  3. Если субтитры есть — это САМЫЙ надёжный путь, отдаём их сразу.
//  4. Если субтитров нет, но нашлась прямая (без подписи) аудиодорожка — запускаем
//     фоновую функцию yt-transcribe-background.mjs, которая скачивает аудио
//     и распознаёт речь через Groq Whisper (см. GROQ_API_KEY в настройке).
//  5. Если ни того, ни другого — честно говорим, что для этого видео расшифровка
//     недоступна (см. docs/youtube-import-setup.md — известное ограничение).
//
// ВАЖНО: это неофициальный API YouTube. Google блокирует часть запросов с IP
// дата-центров (в т.ч. Netlify) и время от времени меняет протокол — подробности
// и признаки поломки см. в docs/youtube-import-setup.md.

import { getStore } from '@netlify/blobs';

const MAX_DURATION_SEC = 20 * 60; // ролики строго до 20 минут
const ANDROID_CLIENT = { clientName: 'ANDROID', clientVersion: '19.29.37', androidSdkVersion: 34 };
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

const ID_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
];

export function parseVideoId(url) {
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

/** Свежий ключ INNERTUBE_API_KEY со страницы видео (переиспользуем сам HTML не приходится — он лёгкий). */
async function fetchInnertubeKey(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
  });
  if (!res.ok) throw Object.assign(new Error('watch-page-failed'), { code: 'yt-unavailable', status: res.status });
  const html = await res.text();
  const m = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  if (!m) throw Object.assign(new Error('no-innertube-key'), { code: 'yt-blocked' });
  return m[1];
}

async function fetchPlayerData(videoId, apiKey) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({
      videoId,
      context: { client: ANDROID_CLIENT },
    }),
  });
  if (!res.ok) throw Object.assign(new Error('player-failed'), { code: 'yt-blocked', status: res.status });
  return res.json();
}

/** JSON3-формат субтитров YouTube → компактные сегменты [{t: сек, text}]. */
function parseJson3(data) {
  const events = Array.isArray(data?.events) ? data.events : [];
  const segments = [];
  for (const e of events) {
    if (!Array.isArray(e.segs)) continue;
    const text = e.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    segments.push({ t: Math.max(0, Math.round((e.tStartMs || 0) / 1000)), text });
  }
  return segments;
}

async function fetchCaptionSegments(track) {
  const url = track.baseUrl + (track.baseUrl.includes('fmt=') ? '' : '&fmt=json3');
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) return [];
  let data;
  try { data = await res.json(); } catch (e) { return []; }
  return parseJson3(data);
}

/** Выбирает субтитры: ручные предпочтительнее автоматических; иначе первая доступная дорожка. */
function pickCaptionTrack(tracks) {
  if (!tracks?.length) return null;
  const manual = tracks.find(t => t.kind !== 'asr');
  return manual || tracks[0];
}

/** Прямая (без цифровой подписи) аудиодорожка с наименьшим битрейтом — быстрее скачать, безопаснее по лимиту Whisper. */
function pickDirectAudioFormat(streamingData) {
  const formats = [
    ...(streamingData?.formats || []),
    ...(streamingData?.adaptiveFormats || []),
  ];
  const audio = formats.filter(f => f.url && String(f.mimeType || '').startsWith('audio/'));
  if (!audio.length) return null;
  audio.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
  return audio[0];
}

function jobsStore() {
  return getStore({ name: 'yt-import-jobs', consistency: 'strong' });
}

/** Ключ из payload: только разумный формат, иначе игнорируем (защита заголовка Authorization). */
function cleanApiKey(raw) {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{20,200}$/.test(s) ? s : '';
}

async function startTranscription(req, jobId, audioFormat, videoId, groqApiKey) {
  await jobsStore().setJSON(jobId, { status: 'pending', createdAt: Date.now() });
  const origin = new URL(req.url).origin;
  // Фоновая функция (background: true) сама отвечает 202 сразу — не ждём её завершения.
  fetch(`${origin}/.netlify/functions/yt-transcribe-background`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, videoId, audioUrl: audioFormat.url, mimeType: audioFormat.mimeType, groqApiKey }),
  }).catch(() => { /* фоновая функция сама запишет статус failed при ошибке */ });
}

export default async function handler(req) {
  // --- опрос ранее запущенного распознавания речи ---
  if (req.method === 'GET') {
    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!jobId || !/^[\w-]+$/.test(jobId)) return err('bad-request', 'Нет jobId');
    const job = await jobsStore().get(jobId, { type: 'json' });
    if (!job) return err('not-found', 'Задача не найдена — возможно, истекло время ожидания', 404);
    if (job.status === 'completed') return json({ transcript: job.transcript });
    if (job.status === 'failed') return err(job.errorCode || 'transcript-failed', job.error || 'Не удалось распознать речь', 502);
    return json({ pending: true, jobId });
  }

  if (req.method !== 'POST') return err('bad-request', 'Ожидается POST', 405);

  let payload;
  try { payload = await req.json(); } catch (e) { return err('bad-request', 'Неверный JSON'); }
  const videoId = parseVideoId(payload.url);
  if (!videoId) return err('bad-url', 'Не удалось распознать ссылку на YouTube-видео');

  let playerData;
  try {
    const apiKey = await fetchInnertubeKey(videoId);
    playerData = await fetchPlayerData(videoId, apiKey);
  } catch (e) {
    if (e.code === 'yt-blocked') {
      return err('yt-blocked', 'YouTube временно отклонил запрос с сервера — попробуй ещё раз через минуту', 502);
    }
    return err('yt-unavailable', 'Не удалось связаться с YouTube', 502);
  }

  const status = playerData?.playabilityStatus?.status;
  if (status === 'ERROR') return err('not-found', 'Видео не найдено (удалено или недоступно)', 404);
  if (status === 'LOGIN_REQUIRED') return err('not-found', 'Видео приватное или требует входа', 404);
  if (status && status !== 'OK') {
    return err('not-playable', playerData?.playabilityStatus?.reason || 'Видео недоступно для обработки', 400);
  }

  const details = playerData?.videoDetails || {};
  const durationSec = Number(details.lengthSeconds || 0);
  const video = { videoId, title: details.title || 'YouTube video', durationSec };

  if (durationSec > MAX_DURATION_SEC) {
    const min = Math.floor(durationSec / 60);
    return err('too-long', `Видео длится ~${min} мин — можно обрабатывать ролики до 20 минут`, 400, { video });
  }

  // --- субтитры: самый надёжный путь ---
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  const track = pickCaptionTrack(tracks);
  if (track) {
    const segments = await fetchCaptionSegments(track);
    if (segments.length) {
      return json({ video, transcript: { lang: track.languageCode || null, segments } });
    }
  }

  // --- субтитров нет — пробуем распознать речь по прямой аудиодорожке ---
  const audioFormat = pickDirectAudioFormat(playerData?.streamingData);
  if (!audioFormat) {
    return err(
      'transcript-unavailable',
      'У этого видео нет субтитров, а автоматическая расшифровка сейчас недоступна (см. docs/youtube-import-setup.md)',
      422,
      { video },
    );
  }

  // личный ключ из настроек приложения приоритетнее серверного
  const groqApiKey = cleanApiKey(payload.groqApiKey) || process.env.GROQ_API_KEY || '';
  if (!groqApiKey) {
    return err(
      'config',
      'У видео нет субтитров — для расшифровки речи нужен Groq API ключ: укажи его в Настройках → «Карточки из YouTube» (или настрой на сервере)',
      401,
      { video },
    );
  }

  const jobId = crypto.randomUUID();
  await startTranscription(req, jobId, audioFormat, videoId, groqApiKey);
  return json({ pending: true, jobId, video });
}

export const config = { path: '/api/yt-video' };
