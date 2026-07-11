// Netlify Function: метаданные YouTube + транскрипт через Supadata API.
// POST { url, supadataApiKey } → { video, transcript } | { pending, jobId, video }
// GET  ?jobId=…            → { transcript } | { pending } | ошибка
//
// Личный ключ Supadata обязателен (Настройки → «Карточки из YouTube»);
// опционально можно задать SUPADATA_API_KEY в env для локальной разработки.

import { getStore } from '@netlify/blobs';
import { parseVideoId } from './lib/yt-url.mjs';
import {
  resolveSupadataApiKey,
  fetchYoutubeVideo,
  fetchTranscript,
  fetchTranscriptJob,
  transcriptFromResult,
  mapSupadataError,
} from './lib/supadata.mjs';

const MAX_DURATION_SEC = 20 * 60;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function err(code, message, status = 400, extra = {}) {
  return json({ error: code, message, ...extra }, status);
}

function jobsStore() {
  try {
    return getStore({ name: 'yt-import-jobs', consistency: 'strong' });
  } catch (e) {
    const mem = globalThis.__ytJobsMem || (globalThis.__ytJobsMem = new Map());
    return {
      async setJSON(key, value) { mem.set(key, value); },
      async get(key) { return mem.has(key) ? mem.get(key) : null; },
    };
  }
}

export { parseVideoId };

export default async function handler(req) {
  const urlObj = new URL(req.url);

  if (req.method === 'GET') {
    const jobId = urlObj.searchParams.get('jobId');
    if (!jobId || !/^[\w-]+$/.test(jobId)) return err('bad-request', 'Нет jobId');

    const job = await jobsStore().get(jobId, { type: 'json' });
    if (!job) return err('not-found', 'Задача не найдена — возможно, истекло время ожидания', 404);
    if (job.status === 'completed') return json({ transcript: job.transcript, video: job.video });
    if (job.status === 'failed') {
      return err(job.errorCode || 'transcript-failed', job.error || 'Не удалось получить транскрипт', 502);
    }

    try {
      const result = await fetchTranscriptJob(job.apiKey, job.supadataJobId);
      if (result.status === 'completed') {
        const transcript = transcriptFromResult(result);
        if (!transcript.segments.length) {
          await jobsStore().setJSON(jobId, {
            ...job,
            status: 'failed',
            errorCode: 'transcript-unavailable',
            error: 'Транскрипт пустой',
          });
          return err('transcript-unavailable', 'Не удалось получить текст видео', 422);
        }
        await jobsStore().setJSON(jobId, { ...job, status: 'completed', transcript });
        return json({ transcript, video: job.video });
      }
      if (result.status === 'failed') {
        const mapped = mapSupadataError(result.error || { error: 'transcript-failed', message: 'Supadata не смогла обработать видео' });
        await jobsStore().setJSON(jobId, { ...job, status: 'failed', errorCode: mapped.code, error: mapped.message });
        return err(mapped.code, mapped.message, mapped.status);
      }
    } catch (e) {
      if (e.code) return err(e.code, e.message, e.status || 502);
      return err('supadata-error', 'Не удалось проверить статус транскрипта', 502);
    }

    return json({ pending: true, jobId, video: job.video });
  }

  if (req.method !== 'POST') return err('bad-request', 'Ожидается POST', 405);

  let payload;
  try { payload = await req.json(); } catch (e) { return err('bad-request', 'Неверный JSON'); }

  const videoUrl = String(payload.url || '').trim();
  const videoId = parseVideoId(videoUrl);
  if (!videoId) return err('bad-url', 'Не удалось распознать ссылку на YouTube-видео');

  const apiKey = resolveSupadataApiKey(payload);
  if (!apiKey) {
    return err(
      'config',
      'Нужен Supadata API ключ — открой Настройки → «Карточки из YouTube» → «Настроить ключи»',
      401,
    );
  }

  let meta;
  try {
    meta = await fetchYoutubeVideo(apiKey, videoUrl);
  } catch (e) {
    if (e.code) return err(e.code, e.message, e.status || 502);
    return err('supadata-error', 'Не удалось получить данные видео', 502);
  }

  const durationSec = Number(meta.duration || 0);
  const video = {
    videoId: meta.id || videoId,
    title: meta.title || 'YouTube video',
    durationSec,
  };

  if (durationSec > MAX_DURATION_SEC) {
    const min = Math.floor(durationSec / 60);
    return err('too-long', `Видео длится ~${min} мин — можно обрабатывать ролики до 20 минут`, 400, { video });
  }

  let transcriptResult;
  try {
    transcriptResult = await fetchTranscript(apiKey, videoUrl, { mode: 'auto' });
  } catch (e) {
    if (e.code) return err(e.code, e.message, e.status || 502, { video });
    return err('supadata-error', 'Не удалось запросить транскрипт', 502, { video });
  }

  if (transcriptResult.async) {
    const jobId = crypto.randomUUID();
    await jobsStore().setJSON(jobId, {
      status: 'pending',
      supadataJobId: transcriptResult.jobId,
      apiKey,
      video,
      createdAt: Date.now(),
    });
    return json({ pending: true, jobId, video });
  }

  const transcript = transcriptFromResult(transcriptResult.data);
  if (!transcript.segments.length) {
    return err('transcript-unavailable', 'У этого видео нет доступного транскрипта', 422, { video });
  }

  return json({ video, transcript });
}

export const config = { path: '/api/yt-video' };
