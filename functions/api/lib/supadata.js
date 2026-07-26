// Клиент Supadata API — транскрипт и метаданные YouTube.
// Документация: https://docs.supadata.ai
//
// Наружу отдаём только свои русские сообщения: текст ответа Supadata может
// содержать чужие детали и куски ключа, его пишем в console.error (detail).

import { isTimeoutError, logUpstream, timeoutMessage } from './_errors.js';

const BASE = 'https://api.supadata.ai/v1';

/** Метаданные и статус джоба — быстрые запросы. */
const META_TIMEOUT_MS = 10000;
/** Синхронный транскрипт Supadata может считаться долго. */
const TRANSCRIPT_TIMEOUT_MS = 60000;

/** Личный ключ Supadata из настроек пользователя. */
export function cleanSupadataApiKey(raw) {
  const s = String(raw || '').trim();
  return /^[\w.-]{8,200}$/.test(s) ? s : '';
}

/** Только ключ из тела запроса — серверный SUPADATA_API_KEY не используем. */
export function resolveSupadataApiKey(payload, _env) {
  return cleanSupadataApiKey(payload?.supadataApiKey) || '';
}

function timeoutError(scope) {
  return Object.assign(new Error(scope), {
    code: 'timeout',
    message: timeoutMessage('Supadata'),
    status: 504,
  });
}

async function supadataFetch(path, apiKey, { searchParams, timeoutMs = META_TIMEOUT_MS, scope = 'supadata' } = {}) {
  const url = new URL(BASE + path);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    logUpstream(scope, e);
    if (isTimeoutError(e)) throw timeoutError(scope);
    throw Object.assign(new Error(scope), {
      code: 'network',
      message: 'Не удалось связаться с Supadata — попробуй позже',
      status: 502,
    });
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* не JSON */ }
  return { res, data };
}

/** Наши сообщения по кодам Supadata — текст апстрима сюда не попадает. */
const ERROR_MESSAGES = {
  unauthorized: 'Supadata не приняла ключ — проверь его в Настройках',
  forbidden: 'Supadata отклонила запрос по этому ключу',
  'invalid-request': 'Supadata не приняла запрос — проверь ссылку на видео',
  'not-found': 'Видео не найдено',
  'transcript-unavailable': 'У этого видео нет доступного транскрипта',
  quota: 'Исчерпан лимит Supadata — попробуй позже',
  'upgrade-required': 'Текущий тариф Supadata не позволяет обработать это видео',
};

/**
 * Supadata error → { code, message, status, detail } для нашего API.
 * `detail` — сырой текст апстрима, только для console.error. В ответ клиенту
 * кладём исключительно `message`.
 */
export function mapSupadataError(data, httpStatus = 502) {
  const raw = data?.error || 'supadata-error';
  const statusMap = {
    unauthorized: 401,
    forbidden: 403,
    'invalid-request': 400,
    'not-found': 404,
    'transcript-unavailable': 422,
    'limit-exceeded': 429,
    'upgrade-required': 402,
  };
  const code = raw === 'limit-exceeded' ? 'quota' : String(raw);
  return {
    code,
    message: ERROR_MESSAGES[code] || 'Supadata не смогла обработать запрос',
    status: statusMap[raw] || (httpStatus >= 400 ? httpStatus : 502),
    detail: String(data?.message || data?.details || ''),
  };
}

function supadataError(scope, data, status) {
  const mapped = mapSupadataError(data, status);
  logUpstream(scope, mapped.detail, { code: mapped.code, status });
  return Object.assign(new Error(scope), {
    code: mapped.code,
    message: mapped.message,
    status: mapped.status,
  });
}

/** GET /youtube/video — title, duration, id. Принимает только валидный videoId. */
export async function fetchYoutubeVideo(apiKey, videoId) {
  const { res, data } = await supadataFetch('/youtube/video', apiKey, {
    searchParams: { id: videoId },
    scope: 'supadata-video',
  });
  if (!res.ok) throw supadataError('supadata-video', data, res.status);
  return data;
}

/** GET /transcript — синхронный транскрипт или { jobId }. url собираем сами. */
export async function fetchTranscript(apiKey, url, { mode = 'auto', lang } = {}) {
  const { res, data } = await supadataFetch('/transcript', apiKey, {
    searchParams: { url, mode, lang },
    timeoutMs: TRANSCRIPT_TIMEOUT_MS,
    scope: 'supadata-transcript',
  });
  if (res.status === 202) return { async: true, jobId: data?.jobId };
  if (!res.ok) throw supadataError('supadata-transcript', data, res.status);
  return { async: false, data };
}

/** GET /transcript/:jobId — статус асинхронной задачи. */
export async function fetchTranscriptJob(apiKey, jobId) {
  const { res, data } = await supadataFetch('/transcript/' + encodeURIComponent(jobId), apiKey, {
    scope: 'supadata-job',
  });
  if (!res.ok) throw supadataError('supadata-job', data, res.status);
  return data;
}

/** Supadata chunks [{text, offset, duration}] → [{t: сек, text}]. */
export function chunksToSegments(content) {
  if (!Array.isArray(content)) return [];
  const segments = [];
  for (const chunk of content) {
    const text = String(chunk?.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    segments.push({
      t: Math.max(0, Math.round((chunk.offset || 0) / 1000)),
      text,
    });
  }
  return segments;
}

export function transcriptFromResult(result) {
  const segments = chunksToSegments(result?.content);
  return { lang: result?.lang || null, segments };
}
