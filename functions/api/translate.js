// Cloudflare Pages Function: перевод текста (прокси MyMemory).
// POST { text, dir: 'ru-en' | 'en-ru' }
//
// Клиент ходит на same-origin /api/translate — так CSP и блокировки
// сторонних доменов не ломают кнопку «Перевести» в редакторе карточки.

const UPSTREAM = "https://api.mymemory.translated.net/get"
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

async function handler(req, _env, subject = "") {
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
  const url = `${UPSTREAM}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`

  let res
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
  } catch (e) {
    console.error("[translate] upstream fetch failed", String(e?.message || e), { subject })
    return json({ error: "upstream", message: "Сервис перевода недоступен — попробуй позже" }, 502)
  }

  if (!res.ok) {
    console.error("[translate] upstream status", res.status, { subject })
    return json({ error: "upstream", message: "Сервис перевода недоступен — попробуй позже" }, 502)
  }

  let data
  try {
    data = await res.json()
  } catch (e) {
    console.error("[translate] bad json", String(e?.message || e), { subject })
    return json({ error: "upstream", message: "Перевод не получен" }, 502)
  }

  const out = String(data?.responseData?.translatedText || "").trim()
  const status = Number(data?.responseStatus)
  if (status && status !== 200) {
    return json(
      {
        error: "quota",
        message: "Лимит перевода исчерпан, попробуйте позже"
      },
      429
    )
  }
  if (!out) return json({ error: "upstream", message: "Перевод не получен" }, 502)

  return json({ text: out, dir })
}

export const onRequestPost = (ctx) => handler(ctx.request, ctx.env, ctx?.data?.subject || "")

/** Для unit-тестов без Pages context. */
export { handler as _handlerForTests, parseDir as _parseDirForTests }
