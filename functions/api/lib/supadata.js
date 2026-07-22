// Клиент Supadata API — транскрипт и метаданные YouTube.
// Документация: https://docs.supadata.ai

const BASE = 'https://api.supadata.ai/v1';

/** Личный ключ Supadata из настроек пользователя. */
export function cleanSupadataApiKey(raw) {
  const s = String(raw || '').trim();
  return /^[\w.-]{8,200}$/.test(s) ? s : '';
}

/** @param {object} payload @param {{ SUPADATA_API_KEY?: string } | undefined} env */
export function resolveSupadataApiKey(payload, env) {
  return cleanSupadataApiKey(payload?.supadataApiKey) || cleanSupadataApiKey(env?.SUPADATA_API_KEY) || '';
}

async function supadataFetch(path, apiKey, { searchParams } = {}) {
  const url = new URL(BASE + path);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      accept: 'application/json',
    },
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* не JSON */ }
  return { res, data };
}

/** Supadata error → { code, message, status } для нашего API. */
export function mapSupadataError(data, httpStatus = 502) {
  const code = data?.error || 'supadata-error';
  const message = data?.message || data?.details || 'Ошибка Supadata';
  const statusMap = {
    unauthorized: 401,
    forbidden: 403,
    'invalid-request': 400,
    'not-found': 404,
    'transcript-unavailable': 422,
    'limit-exceeded': 429,
    'upgrade-required': 402,
  };
  return {
    code: code === 'limit-exceeded' ? 'quota' : code,
    message,
    status: statusMap[code] || (httpStatus >= 400 ? httpStatus : 502),
  };
}

/** GET /youtube/video — title, duration, id. */
export async function fetchYoutubeVideo(apiKey, urlOrId) {
  const { res, data } = await supadataFetch('/youtube/video', apiKey, {
    searchParams: { id: urlOrId },
  });
  if (!res.ok) throw Object.assign(new Error('supadata-video'), mapSupadataError(data, res.status));
  return data;
}

/** GET /transcript — синхронный транскрипт или { jobId }. */
export async function fetchTranscript(apiKey, url, { mode = 'auto', lang } = {}) {
  const { res, data } = await supadataFetch('/transcript', apiKey, {
    searchParams: { url, mode, lang },
  });
  if (res.status === 202) return { async: true, jobId: data?.jobId };
  if (!res.ok) throw Object.assign(new Error('supadata-transcript'), mapSupadataError(data, res.status));
  return { async: false, data };
}

/** GET /transcript/:jobId — статус асинхронной задачи. */
export async function fetchTranscriptJob(apiKey, jobId) {
  const { res, data } = await supadataFetch('/transcript/' + encodeURIComponent(jobId), apiKey);
  if (!res.ok) throw Object.assign(new Error('supadata-job'), mapSupadataError(data, res.status));
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
