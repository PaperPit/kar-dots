// Middleware для всех /api/*: аутентификация, лимиты, ограничение размера тела.
//
// Зачем: эндпоинты /api/* работают на бюджете Worker'а владельца проекта.
// Без этого файла любой мог дёргать их анонимно и без ограничений.
//
// Что делает:
//   1. OPTIONS пропускает как есть — preflight CORS не трогаем (в проде фронт
//      и /api/* на одном origin, свои CORS-заголовки эндпоинты не выдают;
//      любое вмешательство здесь ломало приложение — «Нет соединения с сервером»).
//   2. Content-Length > 256 КБ → 413 (тело при этом не читаем).
//   3. Есть `Authorization: Bearer …` → проверяем токен в Supabase
//      (GET /auth/v1/user). Плохой токен → 401, тихого отката в аноним нет.
//      Успешные проверки кэшируем в KV на 5 минут по хешу токена.
//   4. Нет заголовка → аноним разрешён (в приложении есть локальные аккаунты),
//      но субъект считаем от IP + X-Client-Id, а не от того, что прислал клиент.
//   5. Лимиты в KV: свой бюджет на эндпоинт + общий потолок на IP.
//   6. Кладёт subject/userId в context.data для хендлеров.

import {
  anonSubject,
  bearerToken,
  clientId,
  clientIp,
  ipBucket,
  sha256Hex,
  userSubject
} from "./lib/_subject.js"
import { HOUR_SEC, hitRateLimit } from "./lib/_ratelimit.js"
import { isTimeoutError } from "./lib/_errors.js"
import { jwtIssuer, verifyCfJwt } from "./lib/_cf-auth.js"

/** Тела больше этого не бывает даже у самого длинного транскрипта. */
const MAX_BODY_BYTES = 256 * 1024
/** Snapshot-синк: полный export JSON v3 может быть крупнее. */
const MAX_SYNC_BODY_BYTES = 4 * 1024 * 1024

/** Кэш проверки токена в KV, секунды. */
const AUTH_CACHE_TTL = 300

const AUTH_TIMEOUT_MS = 5000

/** Часовой бюджет на субъект по эндпоинтам. */
const ENDPOINT_LIMITS = {
  "yt-video": 20,
  "yt-generate": 20,
  tts: 40,
  "stock-search": 120,
  translate: 120,
  register: 10,
  login: 30,
  pull: 60,
  push: 30
}
const DEFAULT_ENDPOINT_LIMIT = 60

// Общий потолок на IP: без него достаточно менять X-Client-Id, чтобы получать
// новый анонимный субъект и новый бюджет. Считаем его ТОЛЬКО для анонимов —
// у вошедшего пользователя личность подтверждена токеном, и общий IP (школа,
// офис, мобильный NAT) не должен превращаться в общий лимит на всех.
// Значение — с запасом над самым щедрым эндпоинтом (stock-search, 120),
// иначе потолок по IP срабатывал бы раньше, чем бюджет самого эндпоинта.
const IP_HOURLY_LIMIT = 300

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  })
}

/** '/api/yt-video' → 'yt-video'; '/api/' → 'api'. */
export function endpointScope(pathname) {
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean)
  const last = parts[parts.length - 1] || "api"
  return /^[A-Za-z0-9_-]{1,40}$/.test(last) ? last : "other"
}

export function endpointLimit(scope) {
  return ENDPOINT_LIMITS[scope] ?? DEFAULT_ENDPOINT_LIMIT
}

/** Content-Length больше лимита? (нет заголовка → false). */
export function bodyTooLarge(contentLength, max = MAX_BODY_BYTES) {
  const n = Number(contentLength)
  return Number.isFinite(n) && n > max
}

export function maxBodyForScope(scope) {
  return scope === "push" ? MAX_SYNC_BODY_BYTES : MAX_BODY_BYTES
}

/**
 * Проверка access-token в Supabase с кэшем в KV.
 * @returns {Promise<{ ok: true, userId: string } | { ok: false, status: number, code: string, message: string }>}
 */
async function verifyToken(env, kv, token) {
  const base = String(env?.SUPABASE_URL || "").replace(/\/+$/, "")
  const anonKey = String(env?.SUPABASE_ANON_KEY || "")
  if (!base || !anonKey) {
    // Осознанно падаем закрыто: молча считать проверенным токен нельзя.
    console.error("[api] нет SUPABASE_URL / SUPABASE_ANON_KEY — токен проверить нечем")
    return {
      ok: false,
      status: 503,
      code: "auth-unconfigured",
      message: "Сервер не настроен для проверки входа — попробуй позже"
    }
  }

  const cacheKey = "auth:" + (await sha256Hex(token))
  if (kv) {
    try {
      const cached = await kv.get(cacheKey)
      if (cached) return { ok: true, userId: cached }
    } catch (e) {
      console.warn("[api] кэш проверки токена недоступен", e?.message || e)
    }
  }

  let res
  try {
    res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS)
    })
  } catch (e) {
    console.error("[api] проверка токена не удалась:", e?.message || e)
    return isTimeoutError(e)
      ? {
          ok: false,
          status: 504,
          code: "auth-timeout",
          message: "Проверка входа заняла слишком много времени — попробуй ещё раз"
        }
      : {
          ok: false,
          status: 503,
          code: "auth-unavailable",
          message: "Не удалось проверить вход — попробуй позже"
        }
  }

  if (res.status !== 200) {
    console.error("[api] Supabase отклонил токен, статус", res.status)
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Сессия истекла — войди заново"
    }
  }

  let user = null
  try {
    user = await res.json()
  } catch (e) {
    console.error("[api] Supabase вернул не JSON при проверке токена")
  }
  const subject = userSubject(user?.id)
  if (!subject) {
    console.error("[api] Supabase вернул неожиданный id пользователя")
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Сессия истекла — войди заново"
    }
  }

  if (kv) {
    try {
      await kv.put(cacheKey, String(user.id), { expirationTtl: AUTH_CACHE_TTL })
    } catch (e) {
      console.warn("[api] не удалось закэшировать проверку токена", e?.message || e)
    }
  }
  return { ok: true, userId: String(user.id) }
}

export async function onRequest(context) {
  const { request, env } = context

  // 1. Preflight — мимо всей логики, иначе ломается CORS.
  if (request.method === "OPTIONS") return context.next()

  // 2. Размер тела — до чтения самого тела.
  const scope = endpointScope(new URL(request.url).pathname)
  if (bodyTooLarge(request.headers.get("content-length"), maxBodyForScope(scope))) {
    return json({ error: "too-large", message: "Слишком большой запрос — уменьши транскрипт" }, 413)
  }

  const kv = env?.YT_JOBS || null

  // 3–4. Субъект: CF sync JWT, проверенный Supabase, либо аноним.
  const token = bearerToken(request.headers)
  let subject = ""
  let userId = null
  let cfUserId = null
  if (token) {
    const iss = jwtIssuer(token)
    if (iss === "kar-cf-sync") {
      const secret = String(env?.SYNC_JWT_SECRET || "")
      if (!secret) {
        console.error("[api] SYNC_JWT_SECRET не задан — CF sync токен проверить нечем")
        return json(
          { error: "sync-unconfigured", message: "Синхронизация на сервере не настроена" },
          503
        )
      }
      const verified = await verifyCfJwt(token, secret)
      if (!verified.ok) {
        return json(
          { error: "unauthorized", message: "Сессия синхронизации истекла — войди заново" },
          401
        )
      }
      cfUserId = verified.userId
      userId = verified.userId
      subject = userSubject(userId)
    } else {
      const verified = await verifyToken(env, kv, token)
      if (!verified.ok) {
        return json({ error: verified.code, message: verified.message }, verified.status)
      }
      userId = verified.userId
      subject = userSubject(userId)
    }
  } else {
    subject = await anonSubject(clientIp(request.headers), clientId(request.headers))
  }

  if ((scope === "pull" || scope === "push") && !cfUserId) {
    return json({ error: "unauthorized", message: "Войдите для синхронизации" }, 401)
  }

  // 5. Лимиты. В проде REQUIRE_RATE_LIMIT=1 → без KV API не работает (fail closed).
  // Локально (pages:dev без --kv) — fail open, чтобы не ломать разработку.
  const now = Date.now()
  const failClosed = String(env?.REQUIRE_RATE_LIMIT || "") === "1"

  if (!userId) {
    const byIp = await hitRateLimit(kv, {
      scope: "ip",
      subject: await ipBucket(clientIp(request.headers)),
      limit: IP_HOURLY_LIMIT,
      windowSec: HOUR_SEC,
      now,
      failClosed
    })
    if (!byIp.ok) {
      if (byIp.missingKv) return rateLimitUnconfigured()
      return tooMany(byIp.retryAfter)
    }
  }

  const bySubject = await hitRateLimit(kv, {
    scope,
    subject,
    limit: endpointLimit(scope),
    windowSec: HOUR_SEC,
    now,
    failClosed
  })
  if (!bySubject.ok) {
    if (bySubject.missingKv) return rateLimitUnconfigured()
    return tooMany(bySubject.retryAfter)
  }

  // 6. Хендлеры берут личность отсюда и только отсюда.
  context.data.subject = subject
  context.data.userId = userId
  context.data.cfUserId = cfUserId

  return context.next()
}

function tooMany(retryAfter) {
  const min = Math.max(1, Math.ceil((retryAfter || HOUR_SEC) / 60))
  return json(
    {
      error: "rate-limited",
      message: `Слишком много запросов — попробуй снова примерно через ${min} мин`
    },
    429,
    { "retry-after": String(Math.max(1, retryAfter || HOUR_SEC)) }
  )
}

function rateLimitUnconfigured() {
  console.error("[api] REQUIRE_RATE_LIMIT=1, но биндинг YT_JOBS отсутствует или KV недоступен")
  return json(
    {
      error: "rate-limit-unconfigured",
      message: "Сервер не настроен для лимитов запросов — попробуй позже"
    },
    503
  )
}
