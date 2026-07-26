import { APP_ORIGIN } from "./constants.js"
import { withApiKeys } from "../../../js/lib/youtube-import-settings.js"
import { getExtYtJobUserId } from "./yt-job-owner.js"
import { getAuth } from "./storage.js"
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

/**
 * Заголовки личности для /api/*.
 *
 * Бэкенд (functions/api/_middleware.js) выводит субъекта запроса только из
 * проверенного access-token'а Supabase либо из пары IP + X-Client-Id, а userId
 * в теле игнорирует. Без этих заголовков расширение сваливалось в общий
 * анонимный бюджет лимитов вместе со всеми за тем же NAT и получало 429 —
 * а до правки любой сбой показывался как «Нет соединения с сервером».
 *
 * X-Client-Id — намеренно тот же id, что и владелец YouTube-задачи
 * (getExtYtJobUserId), иначе субъект разъедется и опрос задачи её не найдёт.
 */
async function apiHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra, "X-Client-Id": await getExtYtJobUserId() }
  try {
    const auth = await getAuth()
    const token = auth?.session?.access_token
    if (token) headers["Authorization"] = "Bearer " + token
  } catch {
    /* нет сессии — работаем анонимно, это допустимо */
  }
  return headers
}

/** Человеческий текст по статусу — сообщение сервера всегда в приоритете. */
function apiErrorMessage(status: number, serverMessage?: unknown): string {
  const msg = String(serverMessage || "").trim()
  if (msg) return msg
  if (status === 401) return "Сессия истекла — подключи аккаунт заново"
  if (status === 413) return "Слишком большой запрос — выбери ролик покороче"
  if (status === 429) return "Слишком много запросов — попробуй через несколько минут"
  if (status === 503) return "Сервер КАР-точки временно не отвечает — попробуй позже"
  if (status >= 500) return "Ошибка на сервере КАР-точки — попробуй позже"
  return "Ошибка сервера (" + status + ")"
}

async function apiJson<T = ApiJsonResponse>(path: string, opts: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(APP_ORIGIN + path, {
      ...opts,
      headers: await apiHeaders(opts.headers as Record<string, string> | undefined)
    })
  } catch (e) {
    // Раньше здесь была одна фраза на все случаи, и по ней нельзя было понять,
    // что чинить. Разделяем то, что пользователь может исправить сам, и всё
    // остальное — с текстом реальной причины.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("Нет интернета — проверь соединение и попробуй снова", { cause: e })
    }
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Не удалось достучаться до ${APP_ORIGIN} (${reason}). ` +
        "Проверь интернет; если он есть — запрос мог заблокировать VPN, антивирус или блокировщик рекламы.",
      { cause: e }
    )
  }

  let data: ApiJsonResponse | null = null
  try {
    data = await res.json()
  } catch {
    /* не JSON */
  }
  if (!res.ok || !data || data.error) {
    throw new Error(apiErrorMessage(res.status, data?.message))
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
  if (mergeCues) {
    // Сервер отдаёт сегменты с необязательными полями, а mergeCaptionSegments
    // ждёт заполненные t/text и допускает end: null. Приводим типы на границе
    // явно, а не через as: пустой text здесь ожидаем и безопасен.
    const normalized = segments.map((s) => ({
      t: Number(s?.t) || 0,
      text: String(s?.text ?? ""),
      end: typeof s?.end === "number" ? s.end : null
    }))
    segments = mergeCaptionSegments(normalized).map((s) => ({
      t: s.t,
      text: s.text,
      end: s.end ?? undefined
    }))
  }
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
