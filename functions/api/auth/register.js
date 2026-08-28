// POST /api/auth/register — аккаунт Cloudflare sync (email + пароль).

import {
  hashPassword,
  normalizeEmail,
  newUserId,
  signCfJwt,
  validatePassword
} from "../lib/_cf-auth.js"
import { findUserByEmail, insertUser, jsonResponse, syncDb } from "../lib/_cf-sync.js"

export async function onRequestPost(context) {
  return handleRegister(context.request, context.env)
}

export async function _handlerForTests(request, env) {
  return handleRegister(request, env)
}

async function handleRegister(request, env) {
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
    console.error("[auth/register] SYNC_JWT_SECRET не задан")
    return jsonResponse(
      { error: "sync-unconfigured", message: "Синхронизация на сервере не настроена" },
      503
    )
  }

  const db = syncDb(env)
  if (!db) {
    console.error("[auth/register] SYNC_DB не привязан")
    return jsonResponse(
      { error: "sync-unconfigured", message: "База синхронизации не настроена" },
      503
    )
  }

  const existing = await findUserByEmail(db, email)
  if (existing) {
    return jsonResponse({ error: "email-taken", message: "Этот email уже зарегистрирован" }, 409)
  }

  const id = newUserId()
  const createdAt = Date.now()
  const passwordHash = await hashPassword(email, pwCheck.password)
  try {
    await insertUser(db, { id, email, passwordHash, createdAt })
  } catch (e) {
    console.error("[auth/register] insert failed", e?.message || e)
    return jsonResponse({ error: "db-error", message: "Не удалось создать аккаунт" }, 500)
  }

  const token = await signCfJwt({ userId: id, email, secret })
  return jsonResponse({ token, email, userId: id })
}
