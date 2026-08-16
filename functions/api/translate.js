// Cloudflare Pages Function: перевод текста.
// POST { text, dir: 'ru-en' | 'en-ru', geminiApiKey?: string }
//
// Клиент → same-origin /api/translate (CSP).
//
// Порядок:
//   1) Gemini BYOK (ключ из настроек YouTube) — надёжный смысловой перевод
//   2) Workers AI Llama (несколько моделей / messages+prompt)
//   3) Workers AI m2m100 (english/russian); транслит отбрасываем
//   4) Lingva / Google gtx / MyMemory — HTTP fallbacks

const MYMEMORY = "https://api.mymemory.translated.net/get"
const GTX = "https://translate.googleapis.com/translate_a/single"
const LINGVA = "https://lingva.ml/api/v1"
const GEMINI_MODEL = "gemini-flash-latest"
const LLM_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.2-3b-instruct",
  "@cf/meta/llama-3.2-1b-instruct"
]
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
  out = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean)
  if (!out) return ""
  out = out.replace(/^(translation|перевод)\s*[:\-–—]\s*/i, "")
  out = out.replace(/^["'`«]+|["'`»]+$/g, "").trim()
  return out.slice(0, MAX_TEXT)
}

function cleanGeminiApiKey(raw) {
  const s = String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, "")
  if (!s) return ""
  if (/^(?:AIza[A-Za-z0-9_-]{10,}|AQ\.[A-Za-z0-9._-]{20,})$/.test(s)) return s.slice(0, 512)
  if (/^AQ\./.test(s) && s.length >= 24 && s.length <= 512) return s
  if (/^AIza/.test(s) && s.length >= 20 && s.length <= 512) return s
  return ""
}

function langLabel(code) {
  return code === "ru" ? "Russian" : "English"
}

async function translateWithGemini(apiKey, text, from, to, env) {
  const key = cleanGeminiApiKey(apiKey)
  if (!key) return null
  const model = String(env?.GEMINI_MODEL || GEMINI_MODEL)
  const fromName = langLabel(from)
  const toName = langLabel(to)
  const prompt =
    `You are a bilingual dictionary for language-learning flashcards.\n` +
    `Translate from ${fromName} to ${toName}.\n` +
    `Reply with ONLY the translation. No quotes, no transliteration, no pronunciation, no explanations.\n` +
    `Use the most common everyday meaning.\n\n` +
    text
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 64 }
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    }
  )
  if (!res.ok) {
    const err = new Error(`gemini status ${res.status}`)
    err.code = res.status === 429 ? "quota" : "upstream"
    throw err
  }
  const body = await res.json()
  const raw = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""
  const out = cleanLlmTranslation(raw)
  return out || null
}

async function runLlmOnce(env, model, text, from, to, hintBad) {
  const fromName = langLabel(from)
  const toName = langLabel(to)
  const system =
    "You are a bilingual dictionary for language-learning flashcards. " +
    "Reply with ONLY the translation of the word or short phrase. " +
    "No quotes, no transliteration, no pronunciation, no explanations. " +
    "Use the most common everyday meaning."
  let user = `Translate from ${fromName} to ${toName}:\n${text}`
  if (hintBad) {
    user += `\n\nWrong transliteration to avoid: «${hintBad}». Give the real meaning.`
  }

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 64,
      temperature: 0
    })
    const raw = result?.response ?? result?.result?.response ?? ""
    const out = cleanLlmTranslation(raw)
    if (out) return out
  } catch {
    /* try prompt format */
  }

  const prompt = `${system}\n\n${user}\n\nTranslation:`
  const result = await env.AI.run(model, {
    prompt,
    max_tokens: 64,
    temperature: 0
  })
  const raw = result?.response ?? result?.result?.response ?? ""
  return cleanLlmTranslation(raw) || null
}

async function translateWithLlm(env, text, from, to, hintBad = "") {
  if (!env?.AI || typeof env.AI.run !== "function") return null
  for (const model of LLM_MODELS) {
    try {
      const out = await runLlmOnce(env, model, text, from, to, hintBad)
      if (out) return out
    } catch (e) {
      console.error("[translate] llm model failed", model, String(e?.message || e))
    }
  }
  return null
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

async function translateWithGtx(text, from, to) {
  const url = new URL(GTX)
  url.searchParams.set("client", "gtx")
  url.searchParams.set("sl", from)
  url.searchParams.set("tl", to)
  url.searchParams.set("dt", "t")
  url.searchParams.set("q", text)
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (compatible; KAR-tochki/1.0)"
    }
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

async function translateWithLingva(text, from, to) {
  const url = `${LINGVA}/${from}/${to}/${encodeURIComponent(text)}`
  const res = await fetch(url, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: "application/json" }
  })
  if (!res.ok) {
    const err = new Error(`lingva status ${res.status}`)
    err.code = "upstream"
    throw err
  }
  const data = await res.json()
  const out = String(data?.translation || "").trim()
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
  const failures = []

  const geminiKey = cleanGeminiApiKey(payload?.geminiApiKey)
  if (geminiKey) {
    try {
      const viaGemini = await translateWithGemini(geminiKey, text, from, to, env)
      if (acceptTranslation(text, viaGemini, dir)) {
        return json({ text: viaGemini, dir, provider: "gemini" })
      }
      if (viaGemini) failures.push("gemini-translit")
    } catch (e) {
      failures.push(`gemini:${e?.message || e}`)
      console.error("[translate] gemini failed", String(e?.message || e), { subject })
      if (e?.code === "quota") {
        return json({ error: "quota", message: "Лимит Gemini исчерпан — попробуйте позже" }, 429)
      }
    }
  }

  if (!hasAi) {
    console.warn("[translate] AI binding missing — using HTTP fallbacks", { subject })
  }

  let badMt = ""
  if (hasAi) {
    try {
      const viaMt = await translateWithM2m(env, text, from, to)
      if (acceptTranslation(text, viaMt, dir)) {
        return json({ text: viaMt, dir, provider: "workers-ai-m2m" })
      }
      if (viaMt) {
        badMt = viaMt
        failures.push("m2m-translit")
        console.warn("[translate] m2m transliteration rejected", { text, viaMt, dir, subject })
      }
    } catch (e) {
      failures.push(`m2m:${e?.message || e}`)
      console.error("[translate] m2m failed", String(e?.message || e), { subject })
    }

    try {
      const viaLlm = await translateWithLlm(env, text, from, to, badMt)
      if (acceptTranslation(text, viaLlm, dir)) {
        return json({ text: viaLlm, dir, provider: "workers-ai-llm" })
      }
      if (viaLlm) failures.push("llm-translit")
    } catch (e) {
      failures.push(`llm:${e?.message || e}`)
      console.error("[translate] llm failed", String(e?.message || e), { subject })
    }
  }

  for (const [name, fn] of [
    ["lingva", translateWithLingva],
    ["gtx", translateWithGtx],
    ["mymemory", translateWithMyMemory]
  ]) {
    try {
      const via = await fn(text, from, to)
      if (acceptTranslation(text, via, dir)) {
        return json({ text: via, dir, provider: name })
      }
      failures.push(`${name}-translit`)
      console.warn(`[translate] ${name} transliteration rejected`, { text, via, dir, subject })
    } catch (e) {
      failures.push(`${name}:${e?.message || e}`)
      console.error(`[translate] ${name} failed`, String(e?.message || e), { subject })
      if (e?.code === "quota") {
        return json({ error: "quota", message: "Лимит перевода исчерпан, попробуйте позже" }, 429)
      }
    }
  }

  const hint = geminiKey
    ? "Все провайдеры недоступны — попробуй позже"
    : "Сервис перевода недоступен. Добавь ключ Gemini в Настройки → YouTube — перевод станет стабильнее"
  return json(
    {
      error: "upstream",
      message: hint,
      detail: failures.slice(0, 8).join("|") || (hasAi ? "ai-failed" : "no-ai")
    },
    502
  )
}

export const onRequestPost = (ctx) => handler(ctx.request, ctx.env, ctx?.data?.subject || "")

/** Для unit-тестов без Pages context. */
export {
  handler as _handlerForTests,
  parseDir as _parseDirForTests,
  looksLikeTransliteration as _looksLikeTransliterationForTests
}
