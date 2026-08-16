// Cloudflare Pages Function: перевод текста.
// POST { text, dir: 'ru-en' | 'en-ru' }
//
// Клиент → same-origin /api/translate (CSP).
//
// Порядок провайдеров:
//   1) Workers AI Llama — смысловой перевод (нужен биндинг AI)
//   2) Workers AI m2m100 с именами english/russian
//   3) Google Translate gtx — работает с edge CF без ключа/биндинга
//      (MyMemory с IP Cloudflare часто 502)
//   4) MyMemory — последний шанс / локальный dev

const MYMEMORY = "https://api.mymemory.translated.net/get"
const GTX = "https://translate.googleapis.com/translate_a/single"
const LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct"
const MT_MODEL = "@cf/meta/m2m100-1.2b"
const UPSTREAM_TIMEOUT_MS = 12_000
const MAX_TEXT = 500

/** Workers AI m2m100 в примерах CF ждёт имена, не ISO. */
const AI_LANG_NAME = { en: "english", ru: "russian" }

const CYR_TO_LAT = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

function parseDir(dir) {
  if (dir === "en-ru") return { from: "en", to: "ru" }
  return { from: "ru", to: "en" }
}

function foldLetters(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
}

function cyrToLatApprox(s) {
  return [...foldLetters(s)].map((ch) => CYR_TO_LAT[ch] ?? ch).join("")
}

function editDistance(a, b) {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const prev = new Array(n + 1)
  const cur = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]
  }
  return prev[n]
}

/**
 * Ловит «onion» → «Онеон»: кириллическая запись звучания латиницы,
 * а не смысловой перевод («лук»).
 */
function looksLikeTransliteration(source, target, dir) {
  const src = foldLetters(source).replace(/[^a-zа-яё]/g, "")
  const dst = foldLetters(target).replace(/[^a-zа-яё]/g, "")
  if (!src || !dst || src === dst) return src === dst && src.length > 0

  let left
  let right
  if (dir === "en-ru") {
    left = src.replace(/[^a-z]/g, "")
    right = cyrToLatApprox(dst).replace(/[^a-z]/g, "")
  } else {
    left = cyrToLatApprox(src).replace(/[^a-z]/g, "")
    right = dst.replace(/[^a-z]/g, "")
  }
  if (!left || !right) return false
  const maxLen = Math.max(left.length, right.length)
  if (maxLen < 3) return false
  const dist = editDistance(left, right)
  return dist <= Math.max(1, Math.floor(maxLen * 0.35))
}

function cleanLlmTranslation(raw) {
  let out = String(raw || "").trim()
  if (!out) return ""
  // Берём первую непустую строку, без кавычек и префиксов «Translation:».
  out = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean)
  if (!out) return ""
  out = out.replace(/^(translation|перевод)\s*[:\-–—]\s*/i, "")
  out = out.replace(/^["'`«]+|["'`»]+$/g, "").trim()
  return out.slice(0, MAX_TEXT)
}

async function translateWithLlm(env, text, from, to) {
  if (!env?.AI || typeof env.AI.run !== "function") return null
  const fromName = from === "ru" ? "Russian" : "English"
  const toName = to === "ru" ? "Russian" : "English"
  const result = await env.AI.run(LLM_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You are a bilingual dictionary for language-learning flashcards. " +
          "Reply with ONLY the translation of the word or short phrase. " +
          "No quotes, no transliteration, no pronunciation, no explanations. " +
          "Use the most common everyday meaning."
      },
      {
        role: "user",
        content: `Translate from ${fromName} to ${toName}:\n${text}`
      }
    ],
    max_tokens: 64,
    temperature: 0
  })
  const raw = result?.response ?? result?.result?.response ?? result?.translated_text ?? ""
  const out = cleanLlmTranslation(raw)
  return out || null
}

async function translateWithM2m(env, text, from, to) {
  if (!env?.AI || typeof env.AI.run !== "function") return null
  const result = await env.AI.run(MT_MODEL, {
    text,
    source_lang: AI_LANG_NAME[from] || from,
    target_lang: AI_LANG_NAME[to] || to
  })
  const out = String(result?.translated_text || result?.translatedText || "").trim()
  return out || null
}

async function translateWithMyMemory(text, from, to) {
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
  const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
  if (!res.ok) {
    const err = new Error(`mymemory status ${res.status}`)
    err.code = "upstream"
    throw err
  }
  const data = await res.json()
  const out = String(data?.responseData?.translatedText || "").trim()
  const status = Number(data?.responseStatus)
  if (status && status !== 200) {
    const err = new Error("quota")
    err.code = "quota"
    throw err
  }
  if (!out) {
    const err = new Error("empty")
    err.code = "upstream"
    throw err
  }
  return out
}

/** Неофициальный Google Translate endpoint — обычно доступен с Workers. */
async function translateWithGtx(text, from, to) {
  const url = new URL(GTX)
  url.searchParams.set("client", "gtx")
  url.searchParams.set("sl", from)
  url.searchParams.set("tl", to)
  url.searchParams.set("dt", "t")
  url.searchParams.set("q", text)
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: "application/json" }
  })
  if (!res.ok) {
    const err = new Error(`gtx status ${res.status}`)
    err.code = "upstream"
    throw err
  }
  const data = await res.json()
  const chunks = Array.isArray(data?.[0]) ? data[0] : []
  const out = chunks
    .map((part) => (Array.isArray(part) ? String(part[0] || "") : ""))
    .join("")
    .trim()
  if (!out) {
    const err = new Error("empty")
    err.code = "upstream"
    throw err
  }
  return out
}

function acceptTranslation(source, out, dir) {
  return !!out && !looksLikeTransliteration(source, out, dir)
}

async function handler(req, env = {}, subject = "") {
  if (req.method !== "POST") return json({ error: "bad-request", message: "Ожидается POST" }, 405)

  let payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: "bad-request", message: "Неверный JSON" }, 400)
  }

  const text = String(payload?.text || "")
    .trim()
    .slice(0, MAX_TEXT)
  if (!text) return json({ error: "bad-request", message: "Нечего переводить" }, 400)

  const dir = payload?.dir === "en-ru" ? "en-ru" : "ru-en"
  const { from, to } = parseDir(dir)
  const hasAi = !!(env?.AI && typeof env.AI.run === "function")
  if (!hasAi) {
    console.warn("[translate] AI binding missing — using HTTP fallbacks", { subject })
  }

  if (hasAi) {
    try {
      const viaLlm = await translateWithLlm(env, text, from, to)
      if (acceptTranslation(text, viaLlm, dir)) {
        return json({ text: viaLlm, dir, provider: "workers-ai-llm" })
      }
    } catch (e) {
      console.error("[translate] llm failed", String(e?.message || e), { subject })
    }

    try {
      const viaMt = await translateWithM2m(env, text, from, to)
      if (acceptTranslation(text, viaMt, dir)) {
        return json({ text: viaMt, dir, provider: "workers-ai-m2m" })
      }
      if (viaMt) {
        console.warn("[translate] m2m transliteration rejected", { text, viaMt, dir, subject })
      }
    } catch (e) {
      console.error("[translate] m2m failed", String(e?.message || e), { subject })
    }
  }

  try {
    const viaGtx = await translateWithGtx(text, from, to)
    if (acceptTranslation(text, viaGtx, dir)) {
      return json({ text: viaGtx, dir, provider: "gtx" })
    }
    console.warn("[translate] gtx transliteration rejected", { text, viaGtx, dir, subject })
  } catch (e) {
    console.error("[translate] gtx failed", String(e?.message || e), { subject })
  }

  try {
    const viaMm = await translateWithMyMemory(text, from, to)
    if (!acceptTranslation(text, viaMm, dir)) {
      return json(
        {
          error: "bad-translation",
          message: "Перевод подозрительный (похоже на транслит) — введите вручную"
        },
        422
      )
    }
    return json({ text: viaMm, dir, provider: "mymemory" })
  } catch (e) {
    console.error("[translate] mymemory failed", String(e?.message || e), { subject })
    if (e?.code === "quota") {
      return json({ error: "quota", message: "Лимит перевода исчерпан, попробуйте позже" }, 429)
    }
    return json(
      {
        error: "upstream",
        message: "Сервис перевода недоступен — попробуй позже",
        detail: hasAi ? "ai+gtx+mymemory-failed" : "no-ai+gtx+mymemory-failed"
      },
      502
    )
  }
}

export const onRequestPost = (ctx) => handler(ctx.request, ctx.env, ctx?.data?.subject || "")

/** Для unit-тестов без Pages context. */
export {
  handler as _handlerForTests,
  parseDir as _parseDirForTests,
  looksLikeTransliteration as _looksLikeTransliterationForTests
}
