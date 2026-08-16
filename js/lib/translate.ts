const PAUSE_MS = 320

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
  } catch (e) { console.warn('[kar] setTranslateDir failed:', e); }
}

function normalizeDir(dir: string): "ru-en" | "en-ru" {
  return dir === "en-ru" ? "en-ru" : "ru-en"
}

export async function translateText(text: string, dir: string = getTranslateDir()): Promise<string> {
  const q = String(text || "").trim()
  if (!q) throw new Error("Нечего переводить")

  let res: Response
  try {
    res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: q, dir: normalizeDir(dir) }),
    })
  } catch {
    throw new Error("Нет соединения с сервером перевода")
  }

  let data: { text?: string; message?: string; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    throw new Error(data.message || "Сервис перевода недоступен")
  }
  const out = String(data.text || "").trim()
  if (!out) throw new Error("Перевод не получен")
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
