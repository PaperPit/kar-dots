// Чистые утилиты импорта карточек из YouTube-ролика.
// Серверная часть — netlify/functions/yt-video.mjs и yt-generate.mjs.

import { countWords } from "./yt-segment-merge.js"

const ID_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/
]

export interface YtCandidate {
  front?: string
  back?: string
  kind?: string
  level?: string
  pos?: string
  t?: number | null
  description?: string
}

interface TranscriptSegment {
  text?: string
  t?: number
  end?: number
}

interface FilterResult {
  t: number
  text: string
  end?: number
}

/** Достаёт 11-символьный ID видео из любой формы ссылки (watch, youtu.be, shorts, embed, live). */
export function parseYouTubeId(url: string | null | undefined): string | null {
  const s = String(url || "").trim()
  if (/^[\w-]{11}$/.test(s)) return s
  for (const re of ID_PATTERNS) {
    const m = s.match(re)
    if (m) return m[1]!
  }
  return null
}

/** Нормализация термина для сверки: регистр, пробелы, кавычки, крайняя пунктуация. */
export function normalizeTerm(s: string | null | undefined): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim()
}

/** Возможные базовые формы английского слова: walking → walk; studies → study; stopped → stop. */
export function stemVariants(word: string | null | undefined): Set<string> {
  const w = normalizeTerm(word)
  const out = new Set<string>([w])
  if (!w || w.includes(" ")) return out
  const add = (v: string) => {
    if (v && v.length > 1) out.add(v)
  }
  if (w.endsWith("ies") && w.length > 4) add(w.slice(0, -3) + "y")
  if (w.endsWith("es") && w.length > 3) add(w.slice(0, -2))
  if (w.endsWith("s") && !w.endsWith("ss")) add(w.slice(0, -1))
  if (w.endsWith("ing") && w.length > 5) {
    const base = w.slice(0, -3)
    add(base)
    add(base + "e")
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) add(base.slice(0, -1))
  }
  if (w.endsWith("ied") && w.length > 4) add(w.slice(0, -3) + "y") // studied → study
  if (w.endsWith("ed") && w.length > 4) {
    const base = w.slice(0, -2)
    add(base) // walked → walk
    add(w.slice(0, -1)) // loved → love
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) add(base.slice(0, -1)) // stopped → stop
  }
  out.delete("")
  return out
}

/** Термин уже известен? Проверяет сам термин и его вероятные базовые формы. */
export function isKnownTerm(term: string | null | undefined, knownSet: Set<string>): boolean {
  const n = normalizeTerm(term)
  if (!n) return true
  if (knownSet.has(n)) return true
  if (!n.includes(" ")) {
    for (const v of stemVariants(n)) if (knownSet.has(v)) return true
  }
  return false
}

/** Собирает Set нормализованных front'ов из массивов карточек (паки + YouTube-папки). */
export function collectKnownTerms(cardArrays: Array<Array<{ front?: string } | null | undefined> | null | undefined>): Set<string> {
  const known = new Set<string>()
  for (const cards of cardArrays || []) {
    for (const c of cards || []) {
      const n = normalizeTerm(c && c.front)
      if (n) known.add(n)
    }
  }
  return known
}

/** Карточка была создана импортом из YouTube? (по таймкод-ссылке в описании) */
export function isYoutubeCard(card: { description?: string } | null | undefined): boolean {
  return /youtube\.com\/watch\?v=/.test(String(card?.description || ""))
}

/**
 * Фильтрует кандидатов от LLM: убирает известные слова, дубли внутри выдачи
 * и слова, уже покрытые фразами из этой же выдачи (фраза приоритетнее слова).
 */
export function filterNewCandidates<T extends YtCandidate>(candidates: T[], knownSet: Set<string>): { phrases: T[]; words: T[] } {
  const seen = new Set<string>()
  const phrases: T[] = []
  const words: T[] = []
  for (const c of candidates || []) {
    const n = normalizeTerm(c && c.front)
    if (!n || seen.has(n)) continue
    seen.add(n)
    if (c.kind === "phrase") {
      if (!knownSet.has(n)) phrases.push(c)
    } else {
      words.push(c)
    }
  }
  const coveredByPhrases = new Set<string>()
  for (const p of phrases) {
    for (const token of normalizeTerm(p.front).split(" ")) {
      for (const v of stemVariants(token)) coveredByPhrases.add(v)
      coveredByPhrases.add(token)
    }
  }
  const newWords = words.filter((w) => {
    const n = normalizeTerm(w.front)
    if (isKnownTerm(n, knownSet)) return false
    if (coveredByPhrases.has(n)) return false
    for (const v of stemVariants(n)) if (coveredByPhrases.has(v)) return false
    return true
  })
  return { phrases, words: newWords }
}

/** Фильтр сегментов перед режимом «Предложения»: мин. длина, dedupe. */
export function filterTranscriptSegments(
  segments: Array<TranscriptSegment | null | undefined>,
  { minWords = 3, dedupe = true }: { minWords?: number; dedupe?: boolean } = {}
): FilterResult[] {
  const seen = dedupe ? new Set<string>() : null
  const out: FilterResult[] = []
  for (const s of segments || []) {
    const text = String(s?.text || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!text) continue
    if (minWords > 0 && countWords(text) < minWords) continue
    if (seen) {
      const n = normalizeTerm(text)
      if (!n || seen.has(n)) continue
      seen.add(n)
    }
    const t = Math.max(0, Math.round(Number(s?.t) || 0))
    const end = Number.isFinite(Number(s?.end)) ? Math.max(0, Math.round(Number(s?.end))) : undefined
    out.push(end != null ? { t, text, end } : { t, text })
  }
  return out
}

/** Убирает уже известные предложения и дубли внутри выдачи. */
export function filterNewSentences<T extends YtCandidate>(candidates: T[], knownSet: Set<string>): T[] {
  const seen = new Set<string>()
  const sentences: T[] = []
  for (const c of candidates || []) {
    const n = normalizeTerm(c && c.front)
    if (!n || seen.has(n)) continue
    seen.add(n)
    if (!knownSet.has(n)) sentences.push(c)
  }
  return sentences
}

/** 125 → "2:05", 3723 → "1:02:03" */
export function fmtTimestamp(sec: number | string | null | undefined): string {
  const s0 = Math.max(0, Math.floor(Number(sec) || 0))
  const h = Math.floor(s0 / 3600)
  const m = Math.floor((s0 % 3600) / 60)
  const s = s0 % 60
  const mm = h ? String(m).padStart(2, "0") : String(m)
  const ss = String(s).padStart(2, "0")
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Ссылка открывает видео на 2 сек раньше слова — чтобы услышать его в контексте. */
const LINK_LEAD_SEC = 2

export function buildYtLink(videoId: string, t: number | string | null | undefined): string {
  const sec = Math.max(0, Math.floor(Number(t) || 0) - LINK_LEAD_SEC)
  return `https://www.youtube.com/watch?v=${videoId}&t=${sec}s`
}

/**
 * description карточки в стиле паков: «B1 · гл.» / «B1 · phrase» + таймкод-ссылка.
 * Ссылка — единственный маркер YouTube-карточки, не убирать (см. isYoutubeCard).
 */
export function buildCardDescription(candidate: YtCandidate, videoId: string | null | undefined): string {
  const parts: string[] = []
  if (candidate.level) parts.push(candidate.level)
  const kindLabel =
    candidate.kind === "phrase"
      ? "phrase"
      : candidate.kind === "sentence"
        ? "sentence"
        : candidate.pos || "слово"
  parts.push(kindLabel)
  let out = parts.join(" · ")
  if (videoId && candidate.t !== null && candidate.t !== undefined) {
    out += ` · <a href="${buildYtLink(videoId, candidate.t)}">▶ ${fmtTimestamp(candidate.t)}</a>`
  }
  return out
}
