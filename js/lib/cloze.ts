/**
 * Авто-cloze: одно слово → пропуск букв; фраза (2+ слова в одном варианте) → пропуск слов;
 * синонимы через / ; | → пропуск букв в одном из вариантов.
 */

const LETTER = /[\p{L}]/u
const WORD_RE = /^([^\p{L}]*)([\p{L}][\p{L}''-]*[\p{L}]|[\p{L}])([^\p{L}]*)$/u
const WORD_GLOBAL_RE = /[\p{L}][\p{L}''-]*/gu

export interface ClozeOptions {
  promptText?: string
  seed?: number
}

export interface ClozeSegment {
  type: "char" | "text" | "blank"
  ch?: string
  text?: string
  hidden?: boolean
  answer?: string
}

export interface ClozeResult {
  mode: "letters" | "words"
  segments: ClozeSegment[]
  plain: string
  hasBlanks: boolean
  hiddenLetters?: string[]
  hiddenWords?: string[]
}

export interface ClozeCheck {
  ok: boolean
}

/** Сколько букв пропустить в слове по числу букв (не символов). */
export function clozeLettersToHide(letterCount: number): number {
  if (letterCount <= 1) return 0
  if (letterCount <= 4) return 1
  return 2
}

/** Сколько слов пропустить во фразе. */
export function clozeWordsToHide(wordCount: number): number {
  if (wordCount < 2) return 0
  if (wordCount <= 3) return 1
  return 2
}

function countLetters(word: string): number {
  let n = 0
  for (const ch of word) if (LETTER.test(ch)) n++
  return n
}

function letterIndices(word: string): number[] {
  const out: number[] = []
  for (let i = 0; i < word.length; i++) {
    if (LETTER.test(word[i] ?? "")) out.push(i)
  }
  return out
}

/** Варианты ответа: `/`, `;`, `|` — список синонимов (запятая не режет фразы вроде «hello, world!»). */
export function splitAnswerVariants(text: string): string[] {
  return String(text || "")
    .split(/[/;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function expandSpaceSynonymVariants(unit: string, promptText: string): string[] | null {
  if (/[/;|,]/.test(unit)) return null
  const promptWords = extractWords(promptText || "")
  if (promptWords.length !== 1) return null
  const parts = unit.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  const words = parts
    .map((p) => {
      const w = extractWords(p)
      return w.length === 1 ? (w[0] ?? "") : null
    })
    .filter((w): w is string => w !== null)
  if (words.length < 2) return null
  return words
}

/** «тёмный, мрачный, угрюмый» — 3+ однословных варианта; «hello, world!» — фраза из двух. */
function expandCommaSynonymVariants(unit: string, promptText: string): string[] | null {
  if (!/,/.test(unit) || /[/;|]/.test(unit)) return null
  const promptWords = extractWords(promptText || "")
  if (promptWords.length !== 1) return null
  const parts = unit
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 3) return null
  const words = parts
    .map((p) => {
      const w = extractWords(p)
      return w.length === 1 ? (w[0] ?? "") : null
    })
    .filter((w): w is string => w !== null)
  if (words.length < 2) return null
  return words
}

/** Синонимы + эвристика: одно слово на лице карточки → несколько однословных переводов через пробел. */
export function resolveAnswerVariants(text: string, options: ClozeOptions = {}): string[] {
  const raw = String(text || "").trim()
  let variants = splitAnswerVariants(raw)
  if (variants.length === 1) {
    const unit = variants[0] ?? ""
    const expanded =
      expandSpaceSynonymVariants(unit, options.promptText ?? "") ||
      expandCommaSynonymVariants(unit, options.promptText ?? "")
    if (expanded) variants = expanded
  }
  return variants
}

export function extractWords(text: string): string[] {
  return [...String(text || "").matchAll(WORD_GLOBAL_RE)].map((m) => m[0])
}

/**
 * Фраза = в одном варианте ответа 2+ слов через пробел (не список синонимов).
 */
export function isClozePhrase(text: string, options: ClozeOptions = {}): boolean {
  const variants = resolveAnswerVariants(text, options)
  if (variants.length > 1) return false
  const unit = variants[0] || String(text || "").trim()
  return extractWords(unit).length >= 2
}

export function isClozeSynonymList(text: string, options: ClozeOptions = {}): boolean {
  return resolveAnswerVariants(text, options).length > 1
}

/** Детерминированный PRNG для стабильного cloze в рамках одной карточки. */
export function clozeSeed(text: string, salt = ""): number {
  let h = 2166136261
  const s = String(text || "") + "|" + String(salt || "")
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickHiddenIndices(indices: number[], count: number, rng: () => number): number[] {
  if (!indices.length || count <= 0) return []
  const hide = Math.min(count, indices.length)
  let pool = indices
  if (indices.length > 2) {
    const inner = indices.filter((_, i) => i > 0 && i < indices.length - 1)
    if (inner.length >= hide) pool = inner
  }
  const shuffled = [...pool].sort(() => rng() - 0.5)
  return shuffled.slice(0, hide).sort((a, b) => a - b)
}

function pickHiddenWordIndices(wordCount: number, count: number, rng: () => number): number[] {
  if (wordCount < 2 || count <= 0) return []
  const hide = Math.min(count, wordCount)
  let pool = Array.from({ length: wordCount }, (_, i) => i)
  if (wordCount > 2) {
    const inner = pool.filter((i) => i > 0 && i < wordCount - 1)
    if (inner.length >= hide) pool = inner
  }
  const shuffled = [...pool].sort(() => rng() - 0.5)
  return shuffled.slice(0, hide).sort((a, b) => a - b)
}

function clozeWord(word: string, rng: () => number): { word: string; hidden: number[]; display: string } {
  const n = countLetters(word)
  const hide = clozeLettersToHide(n)
  if (hide <= 0) {
    return { word, hidden: [], display: word }
  }
  const idx = letterIndices(word)
  const hidden = pickHiddenIndices(idx, hide, rng)
  if (!hidden.length) {
    return { word, hidden: [], display: word }
  }
  const hiddenSet = new Set(hidden)
  let display = ""
  for (let i = 0; i < word.length; i++) {
    display += hiddenSet.has(i) ? "_" : word[i]
  }
  return { word, hidden, display }
}

function normalizeLettersInput(s: string): string {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[^\p{L}]/gu, "")
    .toLowerCase()
}

function normalizeWordInput(s: string): string {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[^\p{L}''-]/gu, "")
    .toLowerCase()
}

function buildClozeLetters(raw: string, _opts: ClozeOptions = {}): ClozeResult {
  const segments: ClozeSegment[] = []
  let plain = ""
  let hasBlanks = false
  let wordIdx = 0
  const hiddenLetters: string[] = []

  const parts = raw.split(/(\s+)/)
  for (const part of parts) {
    if (!part) continue
    if (/^\s+$/.test(part)) {
      for (const ch of part) {
        segments.push({ type: "char", ch })
        plain += ch
      }
      continue
    }

    const m = part.match(WORD_RE)
    if (!m) {
      for (const ch of part) {
        segments.push({ type: "char", ch })
        plain += ch
      }
      continue
    }

    const [, preU, wordU, postU] = m
    const pre = preU ?? ""
    const word = wordU ?? ""
    const post = postU ?? ""
    for (const ch of pre) {
      segments.push({ type: "char", ch })
      plain += ch
    }

    const wordRng = mulberry32(clozeSeed(word, String(wordIdx++)))
    const { hidden } = clozeWord(word, wordRng)
    const hiddenSet = new Set(hidden)
    for (let i = 0; i < word.length; i++) {
      const ch = word[i] ?? ""
      if (hiddenSet.has(i)) {
        segments.push({ type: "char", ch: "_", hidden: true, answer: ch })
        plain += "_"
        hiddenLetters.push(ch)
        hasBlanks = true
      } else {
        segments.push({ type: "char", ch })
        plain += ch
      }
    }

    for (const ch of post) {
      segments.push({ type: "char", ch })
      plain += ch
    }
  }

  return { mode: "letters", segments, plain, hasBlanks, hiddenLetters }
}

/** Синонимы «a / b / c» — пропуски букв только в одном варианте. */
function buildClozeSynonyms(variants: string[], opts: ClozeOptions = {}): ClozeResult {
  const rng = mulberry32(typeof opts.seed === "number" ? opts.seed : clozeSeed(variants.join("|")))
  let targetIdx = Math.floor(rng() * variants.length)
  let targetCloze = buildClozeLetters(variants[targetIdx] ?? "", {
    seed: clozeSeed(variants[targetIdx] ?? "", "syn")
  })

  if (!targetCloze.hasBlanks) {
    for (let i = 0; i < variants.length; i++) {
      const tryCloze = buildClozeLetters(variants[i] ?? "", { seed: clozeSeed(variants[i] ?? "", "syn") })
      if (tryCloze.hasBlanks) {
        targetIdx = i
        targetCloze = tryCloze
        break
      }
    }
  }

  const segments: ClozeSegment[] = []
  let plain = ""
  variants.forEach((v, i) => {
    if (i > 0) {
      segments.push({ type: "text", text: " / " })
      plain += " / "
    }
    if (i === targetIdx) {
      for (const seg of targetCloze.segments) segments.push(seg)
      plain += targetCloze.plain
    } else {
      segments.push({ type: "text", text: v })
      plain += v
    }
  })

  return {
    mode: "letters",
    segments,
    plain,
    hasBlanks: targetCloze.hasBlanks,
    hiddenLetters: targetCloze.hiddenLetters ?? []
  }
}

function buildClozeWords(raw: string, opts: ClozeOptions = {}): ClozeResult {
  const matches = [...raw.matchAll(WORD_GLOBAL_RE)]
  const rng = mulberry32(typeof opts.seed === "number" ? opts.seed : clozeSeed(raw))
  const hideCount = clozeWordsToHide(matches.length)
  const hiddenIndices = new Set(pickHiddenWordIndices(matches.length, hideCount, rng))
  const segments: ClozeSegment[] = []
  const hiddenWords: string[] = []
  let plain = ""
  let lastEnd = 0

  matches.forEach((m, wi) => {
    const before = raw.slice(lastEnd, m.index)
    if (before) {
      segments.push({ type: "text", text: before })
      plain += before
    }
    if (hiddenIndices.has(wi)) {
      segments.push({ type: "blank", answer: m[0] })
      hiddenWords.push(m[0])
      plain += "___"
    } else {
      segments.push({ type: "text", text: m[0] })
      plain += m[0]
    }
    lastEnd = m.index + m[0].length
  })

  const tail = raw.slice(lastEnd)
  if (tail) {
    segments.push({ type: "text", text: tail })
    plain += tail
  }

  return {
    mode: "words",
    segments,
    plain,
    hasBlanks: hiddenWords.length > 0,
    hiddenWords
  }
}

/**
 * Строит cloze для ответа.
 * Синонимы → буквы в одном варианте; одно слово → буквы; фраза → слова.
 */
export function buildClozeText(text: string, options: ClozeOptions = {}): ClozeResult {
  const raw = String(text || "").trim()
  const variants = resolveAnswerVariants(raw, options)
  if (variants.length > 1) {
    return buildClozeSynonyms(variants, options)
  }
  if (isClozePhrase(raw, options)) {
    return buildClozeWords(raw, options)
  }
  return buildClozeLetters(raw, options)
}

/** Проверка ввода: буквы (слово) или слова (фраза), не весь ответ целиком. */
export function checkClozeAnswer(input: string, cloze: ClozeResult): ClozeCheck {
  if (!cloze?.hasBlanks) return { ok: false }

  if (cloze.mode === "words") {
    const expected = (cloze.hiddenWords ?? []).map(normalizeWordInput)
    const got = String(input || "")
      .trim()
      .split(/\s+/)
      .map(normalizeWordInput)
      .filter(Boolean)
    if (got.length !== expected.length) return { ok: false }
    for (let i = 0; i < expected.length; i++) {
      if (got[i] !== expected[i]) return { ok: false }
    }
    return { ok: true }
  }

  const expected = normalizeLettersInput((cloze.hiddenLetters ?? []).join(""))
  const got = normalizeLettersInput(input)
  return { ok: !!expected && got === expected }
}

/** Можно ли построить cloze для этого ответа. */
export function canBuildCloze(text: string, options: ClozeOptions = {}): boolean {
  const raw = String(text || "")
  const variants = resolveAnswerVariants(raw, options)
  if (variants.length > 1) {
    return variants.some((v) => {
      const words = extractWords(v)
      if (words.length === 1) return clozeLettersToHide(countLetters(words[0] ?? "")) > 0
      return words.some((w) => clozeLettersToHide(countLetters(w)) > 0)
    })
  }
  const unit = variants[0] || raw
  const words = extractWords(unit)
  if (words.length >= 2) {
    return clozeWordsToHide(words.length) > 0 && words.some((w) => countLetters(w) >= 2)
  }
  for (const word of words) {
    if (clozeLettersToHide(countLetters(word)) > 0) return true
  }
  return false
}

/** Текст подсказки при показе ответа. */
export function formatClozeReveal(cloze: ClozeResult): string {
  if (cloze.mode === "words") {
    return (cloze.hiddenWords ?? []).join(" · ")
  }
  return (cloze.hiddenLetters ?? []).join("")
}
