// Оркестрация YouTube-импорта: кэш → Supadata, файл субтитров, генерация карточек.

import { parseYouTubeId, buildCardDescription, filterTranscriptSegments } from './youtube-import.js';
import { withApiKeys } from './youtube-import-settings.js';
import { getCachedTranscript, setCachedTranscript } from '../data/yt-transcript-cache.js';
import { parseCaptionFile } from './yt-caption-parsers.js';
import { mergeCaptionSegments } from './yt-segment-merge.js';

const POLL_MS = 2500;
const POLL_MAX_MS = 3 * 60 * 1000;

async function apiJson(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error('Нет соединения с сервером');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* не JSON */ }
  if (!res.ok || data?.error) {
    throw new Error(data?.message || 'Ошибка сервера (' + res.status + ')');
  }
  return data;
}

/** URL → { video, transcript, source: 'cache' | 'supadata' }. */
export async function fetchTranscriptFromUrl(url, settings, { isClosed = () => false, onStatus = () => {} } = {}) {
  const videoId = parseYouTubeId(url);
  if (videoId) {
    onStatus('Проверяю кэш транскрипта…');
    const cached = await getCachedTranscript(videoId);
    if (cached) {
      return {
        video: cached.video,
        transcript: cached.transcript,
        source: 'cache',
      };
    }
  }

  onStatus('Получаю данные видео…');
  let data = await apiJson('/api/yt-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(withApiKeys(settings, { url })),
  });

  if (data.pending) {
    onStatus('Получаю транскрипт через Supadata, это может занять минуту…');
    const deadline = Date.now() + POLL_MAX_MS;
    while (data.pending) {
      if (isClosed()) throw new Error('Отменено');
      if (Date.now() > deadline) throw new Error('Расшифровка заняла слишком много времени — попробуй позже');
      await new Promise(r => setTimeout(r, POLL_MS));
      data = await apiJson('/api/yt-video?jobId=' + encodeURIComponent(data.jobId));
    }
  }

  const video = data.video;
  const transcript = data.transcript;
  if (!transcript?.segments?.length) throw new Error('Не удалось получить текст видео');

  const cacheId = video?.videoId || videoId;
  if (cacheId) {
    await setCachedTranscript(cacheId, { video, transcript });
  }

  return { video, transcript, source: 'supadata' };
}

/** Локальный .srt / .vtt → transcript + video meta. */
export function importFromCaptionFile(text, filename, { url = '', title = '' } = {}) {
  const transcript = parseCaptionFile(text, filename);
  if (!transcript.segments.length) throw new Error('В файле не найдено субтитров');
  const videoId = parseYouTubeId(url) || null;
  const durationSec = transcript.segments.reduce((max, s) => Math.max(max, s.t || 0), 0);
  const video = {
    videoId,
    title: String(title || '').trim() || String(filename || '').replace(/\.(srt|vtt)$/i, '') || 'Субтитры',
    durationSec,
  };
  return { video, transcript, source: 'file' };
}

/** Склейка и фильтр сегментов перед режимом «Предложения». */
export function prepareTranscriptForMode(transcript, mode, { mergeCues = true } = {}) {
  if (mode !== 'sentences') return transcript;
  let segments = transcript?.segments || [];
  if (mergeCues) segments = mergeCaptionSegments(segments);
  segments = filterTranscriptSegments(segments, { minWords: 3, dedupe: true });
  if (!segments.length) {
    throw new Error('После фильтрации не осталось предложений — попробуй другие субтитры');
  }
  return { ...transcript, segments };
}

export async function generateYoutubeCards({ video, transcript, mode, settings }, { isClosed = () => false } = {}) {
  if (isClosed()) throw new Error('Отменено');
  return apiJson('/api/yt-generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(withApiKeys(settings, {
      title: video?.title || '',
      lang: transcript.lang || '',
      mode,
      segments: transcript.segments,
    })),
  });
}

/** Частичное создание: не падает на первой ошибке. */
export async function createYoutubeCardsBatch(createCard, folderId, selected, videoId) {
  let ok = 0;
  const failed = [];
  for (const { cand, back } of selected) {
    const text = String(back || '').trim();
    if (!text) continue;
    try {
      await createCard({
        folder_id: folderId,
        front: cand.front,
        back: text,
        description: buildCardDescription(cand, videoId),
      });
      ok++;
    } catch (e) {
      failed.push({ front: cand.front, message: e.message || 'Ошибка сохранения' });
    }
  }
  return { ok, failed };
}
