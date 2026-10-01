// POST /api/files — upload image to R2
// GET  /api/files?key=&exp=&sig= — signed download (for <img>)
// GET  /api/files?key= + Authorization Bearer — owner download / re-sign

import {
  ALLOWED_IMAGE_TYPES,
  FILE_SIGN_TTL_SEC,
  MAX_FILE_BYTES,
  extForType,
  keyOwnedBy,
  normalizeObjectKey,
  parseR2Ref,
  signFileQuery,
  stableR2Ref,
  verifyFileQuery
} from "./lib/_cf-files.js"

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  })
}

export async function onRequest(context) {
  const { request, env, data } = context
  if (request.method === "POST") return handleUpload(request, env, data)
  if (request.method === "GET") return handleGet(request, env, data)
  return json({ error: "method", message: "Method not allowed" }, 405)
}

export async function _handlerForTests(request, env, data = {}) {
  if (request.method === "POST") return handleUpload(request, env, data)
  if (request.method === "GET") return handleGet(request, env, data)
  return json({ error: "method", message: "Method not allowed" }, 405)
}

async function handleUpload(request, env, data) {
  const userId = String(data?.cfUserId || "")
  if (!userId) {
    return json({ error: "unauthorized", message: "Войдите для загрузки файлов" }, 401)
  }

  const bucket = env?.CARD_IMAGES
  if (!bucket) {
    return json({ error: "files-unconfigured", message: "Хранилище картинок не настроено" }, 503)
  }

  const secret = String(env?.SYNC_JWT_SECRET || "")
  if (!secret) {
    return json({ error: "sync-unconfigured", message: "Синхронизация на сервере не настроена" }, 503)
  }

  const contentType = String(request.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase()
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return json({ error: "bad-type", message: "Допустимы только JPEG/PNG/WebP/GIF" }, 400)
  }

  const buf = await request.arrayBuffer()
  if (!buf.byteLength || buf.byteLength > MAX_FILE_BYTES) {
    return json({ error: "too-large", message: "Файл слишком большой (макс. 2 МБ)" }, 413)
  }

  const id = crypto.randomUUID()
  const key = `${userId}/${id}.${extForType(contentType)}`
  await bucket.put(key, buf, {
    httpMetadata: { contentType }
  })

  const exp = Math.floor(Date.now() / 1000) + FILE_SIGN_TTL_SEC
  const sig = await signFileQuery(secret, key, exp)
  const url = `/api/files?key=${encodeURIComponent(key)}&exp=${exp}&sig=${encodeURIComponent(sig)}`

  return json({
    key,
    ref: stableR2Ref(key),
    url,
    exp
  })
}

async function handleGet(request, env, data) {
  const bucket = env?.CARD_IMAGES
  if (!bucket) {
    return json({ error: "files-unconfigured", message: "Хранилище картинок не настроено" }, 503)
  }

  const secret = String(env?.SYNC_JWT_SECRET || "")
  const url = new URL(request.url)
  let key = normalizeObjectKey(url.searchParams.get("key") || "")
  if (!key) {
    const fromRef = parseR2Ref(url.searchParams.get("ref") || "")
    key = fromRef
  }
  if (!key) {
    return json({ error: "bad-key", message: "Не указан ключ файла" }, 400)
  }

  const cfUserId = String(data?.cfUserId || "")
  const exp = url.searchParams.get("exp")
  const sig = url.searchParams.get("sig")

  let allowed = false
  if (exp && sig && secret) {
    allowed = await verifyFileQuery(secret, key, exp, sig)
  }
  if (!allowed && cfUserId && keyOwnedBy(key, cfUserId)) {
    allowed = true
  }
  // Re-sign helper: ?sign=1 + Bearer → JSON with fresh signed url
  if (cfUserId && keyOwnedBy(key, cfUserId) && url.searchParams.get("sign") === "1") {
    if (!secret) {
      return json({ error: "sync-unconfigured", message: "Синхронизация на сервере не настроена" }, 503)
    }
    const nextExp = Math.floor(Date.now() / 1000) + FILE_SIGN_TTL_SEC
    const nextSig = await signFileQuery(secret, key, nextExp)
    return json({
      key,
      ref: stableR2Ref(key),
      url: `/api/files?key=${encodeURIComponent(key)}&exp=${nextExp}&sig=${encodeURIComponent(nextSig)}`,
      exp: nextExp
    })
  }

  if (!allowed) {
    return json({ error: "unauthorized", message: "Нет доступа к файлу" }, 401)
  }

  const obj = await bucket.get(key)
  if (!obj) {
    return json({ error: "not-found", message: "Файл не найден" }, 404)
  }

  const headers = new Headers()
  headers.set("cache-control", "private, max-age=3600")
  const ct = obj.httpMetadata?.contentType || "application/octet-stream"
  headers.set("content-type", ct)
  return new Response(obj.body, { status: 200, headers })
}
