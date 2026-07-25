/** Тонкая обёртка над js/lib/yt-transcript с origin прод-сайта. */
import { APP_ORIGIN } from "./constants.js"
import {
  fetchTranscriptFromUrl as appFetchTranscript,
  prepareTranscriptForMode,
  generateYoutubeCards as appGenerateYoutubeCards,
  type YtVideo,
  type YtTranscript,
  type YtGenResult,
} from "../../../js/lib/yt-transcript.js"
import type { YtCandidate } from "../../../js/lib/youtube-import.js"
import type { Settings } from "../../../js/data/types.js"

export type { YtVideo, YtTranscript }
export { prepareTranscriptForMode }

export async function fetchTranscriptFromUrl(
  url: string,
  settings: Settings | null,
  opts: { isClosed?: () => boolean; onStatus?: (msg: string) => void } = {}
): Promise<{ video: YtVideo; transcript: YtTranscript; source: "supadata" | "cache" }> {
  return appFetchTranscript(url, settings, {
    ...opts,
    apiBase: APP_ORIGIN,
    cache: null,
  })
}

export async function generateYoutubeCards(
  args: {
    video: YtVideo | null | undefined
    transcript: YtTranscript
    mode: string
    settings: Settings | null
  },
  opts: { isClosed?: () => boolean } = {}
): Promise<{ cards: YtCandidate[]; truncated?: { total: number; used: number } | null } | YtGenResult> {
  return appGenerateYoutubeCards({ ...args, apiBase: APP_ORIGIN }, opts)
}
