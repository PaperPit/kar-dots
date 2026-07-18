// Парсинг .srt / .vtt → { lang, segments: [{ t: сек, text }] } (как Supadata transcript).

import type { YtTranscript, YtTranscriptSegment } from "../data/yt-transcript-cache.js"

/** «00:01:23,456» / «1:23.456» → секунды (целые). */
export function parseCueTime(raw: string | null | undefined): number {
  const s = String(raw || "")
    .trim()
    .split(/\s+/)[0]!
    .replace(",", ".")
  const parts = s.split(":")
  if (parts.length < 2 || parts.length > 3) return 0
  let h = 0
  let m = 0
  let sec = 0
  if (parts.length === 3) {
    h = parseInt(parts[0]!, 10) || 0
    m = parseInt(parts[1]!, 10) || 0
    sec = parseFloat(parts[2]!) || 0
  } else {
    m = parseInt(parts[0]!, 10) || 0
    sec = parseFloat(parts[1]!) || 0
  }
  return Math.max(0, Math.round(h * 3600 + m * 60 + sec))
}

function stripCueText(lines: string[]): string {
  return lines
    .join(" ")
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function langFromFilename(name: string | null | undefined): string | null {
  const m = String(name || "").match(/\.([a-z]{2,3})(?:[-_][\w]+)?\.(?:srt|vtt)$/i)
  return m ? m[1]!.toLowerCase() : null
}

function langFromVttHeader(text: string | null | undefined): string | null {
  const m = String(text || "").match(/^WEBVTT[^\n]*\n(?:[^\n]*\n)*?Language:\s*([a-z]{2,3})/im)
  return m ? m[1]!.toLowerCase() : null
}

function parseTimedBlocks(text: string | null | undefined, { skipHeader }: { skipHeader?: boolean } = {}): YtTranscriptSegment[] {
  const segments: YtTranscriptSegment[] = []
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
  const blocks = normalized.split(/\n\n+/)
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    if (
      skipHeader &&
      (trimmed.startsWith("WEBVTT") || trimmed.startsWith("NOTE") || trimmed.startsWith("STYLE"))
    )
      continue
    const lines = trimmed.split("\n")
    let timeIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (/-->/.test(lines[i]!)) {
        timeIdx = i
        break
      }
    }
    if (timeIdx < 0) continue
    const m = lines[timeIdx]!.match(/(\d[\d:,.]+)\s*-->\s*(\d[\d:,.]+)/)
    if (!m) continue
    const t = parseCueTime(m[1]!)
    const segText = stripCueText(lines.slice(timeIdx + 1))
    if (segText) segments.push({ t, text: segText })
  }
  return segments
}

/** SRT → segments. */
export function parseSrt(text: string | null | undefined): YtTranscript {
  return { lang: null, segments: parseTimedBlocks(text) }
}

/** WebVTT → segments. */
export function parseVtt(text: string | null | undefined): YtTranscript {
  const lang = langFromVttHeader(text)
  return { lang, segments: parseTimedBlocks(text, { skipHeader: true }) }
}

/** Авто по расширению или заголовку WEBVTT. */
export function parseCaptionFile(text: string | null | undefined, filename: string | null | undefined = ""): YtTranscript {
  const ext = String(filename || "")
    .split(".")
    .pop()!
    .toLowerCase()
  const isVtt =
    ext === "vtt" ||
    String(text || "")
      .trimStart()
      .startsWith("WEBVTT")
  const parsed = isVtt ? parseVtt(text) : parseSrt(text)
  return {
    lang: parsed.lang || langFromFilename(filename),
    segments: parsed.segments
  }
}
