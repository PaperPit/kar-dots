const API = "https://api.mymemory.translated.net/get"
const PAUSE_MS = 320

function langPair(from: string, to: string): string {
  return `${from}|${to}`
}

function parseDir(dir: string): { from: string; to: string } {
  if (dir === "en-ru") return { from: "en", to: "ru" }
  return { from: "ru", to: "en" }
}

const DIR_LABELS: Record<string, string> = { "ru-en": "RU → EN", "en-ru": "EN → RU" }

export function translateDirLabel(dir: string): string {
  return DIR_LABELS[dir] ?? DIR_LABELS["ru-en"]!
}

export function flipTranslateDir(dir: string): "ru-en" | "en-ru" {
  return dir === "en-ru" ? "ru-en" : "en-ru"
}

export function getTranslateDir(): "ru-en" | "en-ru" {
  try {
    const v = localStorage.getItem("kar_translate_dir")
    return v === "en-ru" ? "en-ru" : "ru-en"
  } catch (e) {
    return "ru-en"
  }
}

export function setTranslateDir(dir: string): void {
  try {
    localStorage.setItem("kar_translate_dir", dir)
  } catch (e) {}
}

export async function translateText(text: string, dir: string = getTranslateDir()): Promise<string> {
  const q = String(text || "").trim()
  if (!q) throw new Error("Нечего переводить")
  const { from, to } = parseDir(dir)
  const url = `${API}?q=${encodeURIComponent(q)}&langpair=${langPair(from, to)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Сервис перевода недоступен")
  const data = await res.json()
  const out = data?.responseData?.translatedText?.trim()
  if (!out) throw new Error("Перевод не получен")
  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error(data.responseDetails || "Лимит перевода исчерпан, попробуйте позже")
  }
  return out
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface TranslateResult {
  front: string
  back: string
  error?: string
}

/** Перевод списка слов с паузой между запросами. */
export async function translateBatch(
  words: string[],
  dir: string,
  onProgress?: (done: number, total: number) => void
): Promise<TranslateResult[]> {
  const out: TranslateResult[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    try {
      const t = await translateText(w, dir)
      out.push({ front: w, back: t })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      out.push({ front: w, back: "", error: message })
    }
    if (onProgress) onProgress(i + 1, words.length)
    if (i < words.length - 1) await sleep(PAUSE_MS)
  }
  return out
}
