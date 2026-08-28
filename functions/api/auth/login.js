// POST /api/auth/login — вход в Cloudflare sync.

import { normalizeEmail, signCfJwt, validatePassword, verifyPassword } from "../lib/_cf-auth.js"
import { findUserByEmail, jsonResponse, syncDb } from "../lib/_cf-sync.js"

export async function onRequestPost(context) {
  return handleLogin(context.request, context.env)
}

export async function _handlerForTests(request, env) {
  return handleLogin(request, env)
}

async function handleLogin(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: "bad-json", message: "Некорректный JSON" }, 400)
  }

  const email = normalizeEmail(body?.email)
  if (!email) {
    return jsonResponse({ error: "bad-email", message: "Укажите корректный email" }, 400)
  }
  const pwCheck = validatePassword(body?.password)
  if (!pwCheck.ok) {
    return jsonResponse({ error: "bad-password", message: pwCheck.message }, 400)
  }

  const secret = String(env?.SYNC_JWT_SECRET || "")
  if (!secret) {
    return jsonResponse(
      { error: "sync-unconfigured", message: "Синхронизация на сервере не настроена" },
      503
    )
  }

  const db = syncDb(env)
  if (!db) {
    return jsonResponse(
      { error: "sync-unconfigured", message: "База синхронизации не настроена" },
      503
    )
  }

  const user = await findUserByEmail(db, email)
  if (!user) {
    return jsonResponse({ error: "invalid-credentials", message: "Неверный email или пароль" }, 401)
  }

  const ok = await verifyPassword(email, pwCheck.password, user.password_hash)
  if (!ok) {
    return jsonResponse({ error: "invalid-credentials", message: "Неверный email или пароль" }, 401)
  }

  const token = await signCfJwt({ userId: user.id, email, secret })
  return jsonResponse({ token, email, userId: user.id })
}
