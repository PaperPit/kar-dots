// Склейка коротких cue субтитров в предложения (для режима «Предложения»).

export const DEFAULT_MAX_CHARS = 120

export interface CaptionSegment {
  t: number
  text: string
  end?: number | null
}

/** Количество слов в строке (буквы/цифры через пробел). */
export function countWords(text: string | null | undefined): number {
  const s = String(text || "").trim()
  if (!s) return 0
  return s.split(/\s+/).filter(Boolean).length
}

function endsSentence(text: string | null | undefined): boolean {
  return /[.!?…]["')\]]*$/.test(String(text || "").trim())
}

/**
 * Склеивает короткие реплики до конца предложения или лимита символов.
 * @param {Array<{ t: number, text: string, end?: number }>} segments
 * @returns {Array<{ t: number, text: string, end?: number }>}
 */
export function mergeCaptionSegments(
  segments: Array<CaptionSegment | null | undefined>,
  { maxChars = DEFAULT_MAX_CHARS }: { maxChars?: number } = {}
): CaptionSegment[] {
  const out: CaptionSegment[] = []
  let buf: CaptionSegment | null = null

  const flush = () => {
    if (buf?.text?.trim()) out.push(buf)
    buf = null
  }

  for (const s of segments || []) {
    const text = String(s?.text || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!text) continue
    const t = Math.max(0, Math.round(Number(s?.t) || 0))
    const end = Number.isFinite(Number(s?.end)) ? Math.max(0, Math.round(Number(s?.end))) : null

    if (!buf) {
      buf = { t, text, end: end ?? t }
      if (endsSentence(text) || text.length >= maxChars) flush()
      continue
    }

    const joined = buf.text + " " + text
    if (joined.length > maxChars && buf.text) {
      flush()
      buf = { t, text, end: end ?? t }
      if (endsSentence(text) || text.length >= maxChars) flush()
    } else {
      buf.text = joined
      buf.end = end ?? t
      if (endsSentence(joined) || joined.length >= maxChars) flush()
    }
  }
  flush()
  return out
}
