// Cloudflare Pages Function: метаданные YouTube + транскрипт через Supadata.
// POST { url, supadataApiKey } → { video, transcript } | { pending, jobId, video }
// GET  ?jobId=… → { transcript } | { pending } | ошибка
//
// jobId генерируется только на сервере; KV-ключ: job:${subject}:${jobId}, где
// subject даёт middleware (functions/api/_middleware.js). Поле userId в запросе
// БОЛЬШЕ НЕ ЧИТАЕТСЯ: раньше по нему строился ключ KV, и любой мог подставить
// чужой UUID, получив чужой транскрипт вместе с чужим ключом Supadata.
//
// Личный ключ Supadata обязателен; серверный SUPADATA_API_KEY не используется.
// Ключ лежит в KV только пока джоб выполняется — в терминальном состоянии
// запись перезаписывается без него (см. finishJob).

import {
  jobsStore,
  isJobUuid,
  isSubject,
  makeJobKey,
  stripJobSecrets,
  JOB_TTL_SEC,
  JOB_PENDING_TTL_SEC,
} from './_kv.js';
import { subjectFromRequest } from './lib/_subject.js';
import { parseVideoId, buildWatchUrl } from './lib/yt-url.js';
import {
  resolveSupadataApiKey,
  fetchYoutubeVideo,
  fetchTranscript,
  fetchTranscriptJob,
  transcriptFromResult,
  mapSupadataError,
} from './lib/supadata.js';
import { logUpstream } from './lib/_errors.js';

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

export { parseVideoId, isJobUuid, makeJobKey };

/**
 * Личность вызывающего. Обычно её кладёт middleware; локальный dev-server
 * (scripts/dev-server.mjs) зовёт хендлер напрямую — тогда считаем сами.
 * Ни при каком раскладе не берём идентификатор из тела/квери запроса.
 */
async function resolveSubject(ctx) {
  const fromMiddleware = ctx?.data?.subject;
  if (isSubject(fromMiddleware)) return fromMiddleware;
  return subjectFromRequest(ctx.request);
}

/** Терминальная запись джоба: без ключа Supadata, обычный TTL. */
async function finishJob(store, key, job, patch) {
  await store.setJSON(key, { ...stripJobSecrets(job), ...patch }, JOB_TTL_SEC);
}

async function loadOwnedJob(store, subject, jobId) {
  if (!isSubject(subject) || !isJobUuid(jobId)) {
    return { error: err('bad-request', 'Нет jobId') };
  }
  const key = makeJobKey(subject, jobId);
  let job = await store.get(key);
  // KV eventually consistent — один короткий ретрай при «не найдено»
  if (!job) {
    await new Promise((r) => setTimeout(r, 200));
    job = await store.get(key);
  }
  // Чужой subject → ключа просто нет: 404, без подсказки о существовании задачи.
  if (!job) return { error: err('not-found', 'Задача не найдена — возможно, истекло время ожидания', 404) };
  if (job.subject && job.subject !== subject) {
    return { error: err('forbidden', 'Нет доступа к этой задаче', 403) };
  }
  return { key, job };
}

async function handleGet(ctx, store, subject) {
  const urlObj = new URL(ctx.request.url);
  const jobId = urlObj.searchParams.get('jobId');
  const loaded = await loadOwnedJob(store, subject, jobId);
  if (loaded.error) return loaded.error;
  const { key, job } = loaded;

  if (job.status === 'completed') return json({ transcript: job.transcript, video: job.video });
  if (job.status === 'failed') {
    return err(job.errorCode || 'transcript-failed', job.error || 'Не удалось получить транскрипт', 502);
  }

  if (!job.apiKey) {
    // Ключ уже вычищен (терминальное состояние или истёк TTL pending-записи).
    return err('not-found', 'Задача больше недоступна — запусти импорт заново', 404);
  }

  try {
    const result = await fetchTranscriptJob(job.apiKey, job.supadataJobId);
    if (result.status === 'completed') {
      const transcript = transcriptFromResult(result);
      if (!transcript.segments.length) {
        await finishJob(store, key, job, {
          status: 'failed',
          errorCode: 'transcript-unavailable',
          error: 'Транскрипт пустой',
        });
        return err('transcript-unavailable', 'Не удалось получить текст видео', 422);
      }
      await finishJob(store, key, job, { status: 'completed', transcript });
      return json({ transcript, video: job.video });
    }
    if (result.status === 'failed') {
      const mapped = mapSupadataError(result.error || { error: 'transcript-failed' });
      logUpstream('yt-video-job', mapped.detail, { code: mapped.code });
      await finishJob(store, key, job, {
        status: 'failed',
        errorCode: mapped.code,
        error: mapped.message,
      });
      return err(mapped.code, mapped.message, mapped.status);
    }
  } catch (e) {
    if (e.code) return err(e.code, e.message, e.status || 502);
    logUpstream('yt-video-job', e);
    return err('supadata-error', 'Не удалось проверить статус транскрипта', 502);
  }

  return json({ pending: true, jobId, video: job.video });
}

async function handlePost(ctx, store, subject) {
  const { request: req, env } = ctx;

  let payload;
  try { payload = await req.json(); } catch (e) { return err('bad-request', 'Неверный JSON'); }

  // payload.userId сознательно игнорируем — личность берём только из subject.
  const videoId = parseVideoId(payload.url);
  if (!videoId) return err('bad-url', 'Не удалось распознать ссылку на YouTube-видео');
  // В апстрим уходит только ссылка, которую собрали мы сами.
  const watchUrl = buildWatchUrl(videoId);

  const apiKey = resolveSupadataApiKey(payload, env);
  if (!apiKey) {
    return err(
      'config',
      'Нужен Supadata API ключ — открой Настройки → «Карточки из YouTube» → «Настроить ключи»',
      401,
    );
  }

  let meta;
  try {
    meta = await fetchYoutubeVideo(apiKey, videoId);
  } catch (e) {
    if (e.code) return err(e.code, e.message, e.status || 502);
    logUpstream('yt-video', e);
    return err('supadata-error', 'Не удалось получить данные видео', 502);
  }

  const durationSec = Number(meta.duration || 0);
  const video = {
    videoId: parseVideoId(meta.id) || videoId,
    title: String(meta.title || 'YouTube video').slice(0, 300),
    durationSec,
  };

  if (durationSec > MAX_DURATION_SEC) {
    const min = Math.floor(durationSec / 60);
    return err('too-long', `Видео длится ~${min} мин — можно обрабатывать ролики до 20 минут`, 400, { video });
  }

  let transcriptResult;
  try {
    transcriptResult = await fetchTranscript(apiKey, watchUrl, { mode: 'auto' });
  } catch (e) {
    if (e.code) return err(e.code, e.message, e.status || 502, { video });
    logUpstream('yt-video', e);
    return err('supadata-error', 'Не удалось запросить транскрипт', 502, { video });
  }

  if (transcriptResult.async) {
    const jobId = crypto.randomUUID();
    const key = makeJobKey(subject, jobId);
    // Короткий TTL: пока запись жива, в KV лежит личный ключ Supadata.
    await store.setJSON(
      key,
      {
        status: 'pending',
        subject,
        supadataJobId: transcriptResult.jobId,
        apiKey,
        video,
        createdAt: Date.now(),
      },
      JOB_PENDING_TTL_SEC,
    );
    return json({ pending: true, jobId, video });
  }

  const transcript = transcriptFromResult(transcriptResult.data);
  if (!transcript.segments.length) {
    return err('transcript-unavailable', 'У этого видео нет доступного транскрипта', 422, { video });
  }

  return json({ video, transcript });
}

async function handler(ctx) {
  const store = jobsStore(ctx.env);
  const subject = await resolveSubject(ctx);

  if (ctx.request.method === 'GET') return handleGet(ctx, store, subject);
  if (ctx.request.method !== 'POST') return err('bad-request', 'Ожидается POST', 405);
  return handlePost(ctx, store, subject);
}

export const onRequest = (ctx) => handler(ctx);
