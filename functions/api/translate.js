// Cloudflare Pages Function: перевод текста.
// POST { text, dir: 'ru-en' | 'en-ru' }
//
// Клиент → same-origin /api/translate (CSP).
// Прод: Workers AI (@cf/meta/m2m100-1.2b) — без исходящих запросов к
// сторонним API. MyMemory с edge Cloudflare часто недоступен (блокировка
// IP датацентров / антибот), поэтому только как fallback без биндинга AI
// (локальный npm run dev).

const MYMEMORY = "https://api.mymemory.translated.net/get"
const AI_MODEL = "@cf/meta/m2m100-1.2b"
const UPSTREAM_TIMEOUT_MS = 12_000
const MAX_TEXT = 500

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

async function translateWithWorkersAI(env, text, from, to) {
  if (!env?.AI || typeof env.AI.run !== "function") return null
  const result = await env.AI.run(AI_MODEL, {
    text,
    source_lang: from,
    target_lang: to
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

  try {
    const viaAi = await translateWithWorkersAI(env, text, from, to)
    if (viaAi) return json({ text: viaAi, dir, provider: "workers-ai" })
  } catch (e) {
    console.error("[translate] workers-ai failed", String(e?.message || e), { subject })
  }

  try {
    const viaMm = await translateWithMyMemory(text, from, to)
    return json({ text: viaMm, dir, provider: "mymemory" })
  } catch (e) {
    console.error("[translate] mymemory failed", String(e?.message || e), { subject })
    if (e?.code === "quota") {
      return json({ error: "quota", message: "Лимит перевода исчерпан, попробуйте позже" }, 429)
    }
    return json({ error: "upstream", message: "Сервис перевода недоступен — попробуй позже" }, 502)
  }
}

export const onRequestPost = (ctx) => handler(ctx.request, ctx.env, ctx?.data?.subject || "")

/** Для unit-тестов без Pages context. */
export {
  handler as _handlerForTests,
  parseDir as _parseDirForTests,
  translateWithWorkersAI as _translateWithWorkersAIForTests
}
