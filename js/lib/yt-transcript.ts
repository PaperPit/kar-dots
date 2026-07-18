// Оркестрация YouTube-импорта: кэш → Supadata, файл субтитров, генерация карточек.

import { parseYouTubeId, buildCardDescription, filterTranscriptSegments, type YtCandidate } from "./youtube-import.js"
import { withApiKeys } from "./youtube-import-settings.js"
import { getCachedTranscript, setCachedTranscript } from "../data/yt-transcript-cache.js"
import type { YtVideo, YtTranscript } from "../data/yt-transcript-cache.js"
import { parseCaptionFile } from "./yt-caption-parsers.js"
import { mergeCaptionSegments } from "./yt-segment-merge.js"
import type { Settings } from "../data/types.js"

const POLL_MS = 2500
const POLL_MAX_MS = 3 * 60 * 1000

interface ImportOptions {
  isClosed?: () => boolean
  onStatus?: (msg: string) => void
}

interface ApiJsonResponse {
  error?: unknown
  message?: string
  [key: string]: unknown
}

async function apiJson<T = ApiJsonResponse>(url: string, opts?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, opts)
  } catch {
    throw new Error("Нет соединения с сервером")
  }
  let data: ApiJsonResponse | null = null
  try {
    data = await res.json()
  } catch {
    /* не JSON */
  }
  if (!res.ok || !data || data.error) {
    throw new Error((data && data.message) || "Ошибка сервера (" + res.status + ")")
  }
  return data as T
}

export interface YtGenResult {
  cards: YtCandidate[]
  truncated?: { total: number; used: number } | null
  [key: string]: unknown
}

/** URL → { video, transcript, source: 'cache' | 'supadata' }. */
export async function fetchTranscriptFromUrl(
  url: string | null | undefined,
  settings: Settings | null,
  { isClosed = () => false, onStatus = () => {} }: ImportOptions = {}
): Promise<{ video: YtVideo; transcript: YtTranscript; source: "cache" | "supadata" }> {
  const videoId = parseYouTubeId(url)
  if (videoId) {
    onStatus("Проверяю кэш транскрипта…")
    const cached = await getCachedTranscript(videoId)
    if (cached) {
      return {
        video: cached.video ?? { videoId },
        transcript: cached.transcript,
        source: "cache"
      }
    }
  }

  onStatus("Получаю данные видео…")
  let data = await apiJson("/api/yt-video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withApiKeys(settings, { url }))
  })

  if (data.pending) {
    onStatus("Получаю транскрипт через Supadata, это может занять минуту…")
    const deadline = Date.now() + POLL_MAX_MS
    while (data.pending) {
      if (isClosed()) throw new Error("Отменено")
      if (Date.now() > deadline)
        throw new Error("Расшифровка заняла слишком много времени — попробуй позже")
      await new Promise((r) => setTimeout(r, POLL_MS))
      data = await apiJson("/api/yt-video?jobId=" + encodeURIComponent(String(data.jobId)))
    }
  }

  const video = data.video as YtVideo
  const transcript = data.transcript as YtTranscript
  if (!transcript?.segments?.length) throw new Error("Не удалось получить текст видео")

  const cacheId = video?.videoId || videoId
  if (cacheId) {
    await setCachedTranscript(cacheId, { video, transcript })
  }

  return { video, transcript, source: "supadata" }
}

/** Локальный .srt / .vtt → transcript + video meta. */
export function importFromCaptionFile(
  text: string | null | undefined,
  filename: string | null | undefined,
  { url = "", title = "" }: { url?: string; title?: string } = {}
): { video: YtVideo; transcript: YtTranscript; source: "file" } {
  const transcript = parseCaptionFile(text, filename)
  if (!transcript.segments.length) throw new Error("В файле не найдено субтитров")
  const videoId = parseYouTubeId(url) || null
  const durationSec = transcript.segments.reduce((max, s) => Math.max(max, s.t || 0), 0)
  const video: YtVideo = {
    videoId,
    title:
      String(title || "").trim() ||
      String(filename || "").replace(/\.(srt|vtt)$/i, "") ||
      "Субтитры",
    durationSec
  }
  return { video, transcript, source: "file" }
}

/** Склейка и фильтр сегментов перед режимом «Предложения». */
export function prepareTranscriptForMode(
  transcript: YtTranscript,
  mode: string,
  { mergeCues = true }: { mergeCues?: boolean } = {}
): YtTranscript {
  if (mode !== "sentences") return transcript
  let segments = transcript?.segments || []
  if (mergeCues) segments = mergeCaptionSegments(segments)
  segments = filterTranscriptSegments(segments, { minWords: 3, dedupe: true })
  if (!segments.length) {
    throw new Error("После фильтрации не осталось предложений — попробуй другие субтитры")
  }
  return { ...transcript, segments }
}

interface GenerateYoutubeCardsArgs {
  video: YtVideo | null | undefined
  transcript: YtTranscript
  mode: string
  settings: Settings | null
}

export async function generateYoutubeCards(
  { video, transcript, mode, settings }: GenerateYoutubeCardsArgs,
  { isClosed = () => false }: { isClosed?: () => boolean } = {}
): Promise<YtGenResult> {
  if (isClosed()) throw new Error("Отменено")
  return apiJson<YtGenResult>("/api/yt-generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      withApiKeys(settings, {
        title: video?.title || "",
        lang: transcript.lang || "",
        mode,
        segments: transcript.segments
      })
    )
  })
}

interface SelectedCandidate {
  cand: YtCandidate
  back: string
}

/** Частичное создание: не падает на первой ошибке. */
export async function createYoutubeCardsBatch(
  createCard: (card: { folder_id: string; front: string; back: string; description: string }) => Promise<unknown>,
  folderId: string,
  selected: SelectedCandidate[],
  videoId: string | null
): Promise<{ ok: number; failed: { front: string; message: string }[] }> {
  let ok = 0
  const failed: { front: string; message: string }[] = []
  for (const { cand, back } of selected) {
    const text = String(back || "").trim()
    if (!text) continue
    try {
      await createCard({
        folder_id: folderId,
        front: cand.front || "",
        back: text,
        description: buildCardDescription(cand, videoId)
      })
      ok++
    } catch (e) {
      const err = e as Error
      failed.push({ front: cand.front || "", message: err.message || "Ошибка сохранения" })
    }
  }
  return { ok, failed }
}
