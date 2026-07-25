import { APP_ORIGIN } from "./constants.js"
import { withApiKeys } from "../../../js/lib/youtube-import-settings.js"
import { getExtYtJobUserId } from "./yt-job-owner.js"
import {
  parseYouTubeId,
  filterTranscriptSegments,
  type YtCandidate
} from "../../../js/lib/youtube-import.js"
import { mergeCaptionSegments } from "../../../js/lib/yt-segment-merge.js"
import type { Settings } from "../../../js/data/types.js"

const POLL_MS = 2500
const POLL_MAX_MS = 3 * 60 * 1000

export interface YtVideo {
  videoId?: string | null
  title?: string
  durationSec?: number
  [k: string]: unknown
}

export interface YtTranscript {
  lang?: string
  segments: Array<{ t?: number; end?: number; text?: string }>
}

interface ApiJsonResponse {
  error?: unknown
  message?: string
  pending?: boolean
  jobId?: string
  video?: YtVideo
  transcript?: YtTranscript
  cards?: YtCandidate[]
  truncated?: { total: number; used: number } | null
  [k: string]: unknown
}

async function apiJson<T = ApiJsonResponse>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(APP_ORIGIN + path, opts)
  } catch {
    throw new Error("Нет соединения с сервером КАР-точки")
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

export async function fetchTranscriptFromUrl(
  url: string,
  settings: Settings | null,
  {
    isClosed = () => false,
    onStatus = () => {}
  }: { isClosed?: () => boolean; onStatus?: (msg: string) => void } = {}
): Promise<{ video: YtVideo; transcript: YtTranscript; source: "supadata" }> {
  const videoId = parseYouTubeId(url)
  if (!videoId) throw new Error("Не похоже на ссылку на YouTube-видео")

  onStatus("Получаю данные видео…")
  const userId = await getExtYtJobUserId()
  let data = await apiJson("/api/yt-video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withApiKeys(settings, { url, userId }))
  })

  if (data.pending) {
    onStatus("Получаю транскрипт через Supadata, это может занять минуту…")
    const deadline = Date.now() + POLL_MAX_MS
    while (data.pending) {
      if (isClosed()) throw new Error("Отменено")
      if (Date.now() > deadline) {
        throw new Error("Расшифровка заняла слишком много времени — попробуй позже")
      }
      await new Promise((r) => setTimeout(r, POLL_MS))
      const q =
        "jobId=" + encodeURIComponent(String(data.jobId)) +
        "&userId=" + encodeURIComponent(userId)
      data = await apiJson("/api/yt-video?" + q)
    }
  }

  const video = (data.video || { videoId }) as YtVideo
  const transcript = data.transcript as YtTranscript
  if (!transcript?.segments?.length) {
    throw new Error("Не удалось получить текст видео — возможно, нет субтитров")
  }

  return { video, transcript, source: "supadata" }
}

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

export async function generateYoutubeCards(
  {
    video,
    transcript,
    mode,
    settings
  }: {
    video: YtVideo | null | undefined
    transcript: YtTranscript
    mode: string
    settings: Settings | null
  },
  { isClosed = () => false }: { isClosed?: () => boolean } = {}
): Promise<{ cards: YtCandidate[]; truncated?: { total: number; used: number } | null }> {
  if (isClosed()) throw new Error("Отменено")
  return apiJson("/api/yt-generate", {
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
