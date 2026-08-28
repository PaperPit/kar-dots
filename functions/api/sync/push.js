// POST /api/sync/push — загрузка snapshot JSON v3 (LWW + проверка base_updated_at).

import { clientId } from "../lib/_subject.js"
import { getSnapshot, jsonResponse, syncDb, upsertSnapshot, validateSyncPayload } from "../lib/_cf-sync.js"

const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024

export async function onRequestPost(context) {
  return handlePush(context.request, context.env, context.data)
}

export async function _handlerForTests(request, env, data = {}) {
  return handlePush(request, env, data)
}

async function handlePush(request, env, data) {
  const userId = String(data?.cfUserId || "")
  if (!userId) {
    return jsonResponse({ error: "unauthorized", message: "Войдите для синхронизации" }, 401)
  }

  const db = syncDb(env)
  if (!db) {
    return jsonResponse(
      { error: "sync-unconfigured", message: "База синхронизации не настроена" },
      503
    )
  }

  const raw = await request.text()
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "too-large", message: "Слишком большой бэкап для синка" }, 413)
  }

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonResponse({ error: "bad-json", message: "Некорректный JSON" }, 400)
  }

  let payload
  try {
    payload = validateSyncPayload(body?.payload)
  } catch (e) {
    return jsonResponse(
      { error: "bad-payload", message: e instanceof Error ? e.message : String(e) },
      400
    )
  }

  const baseUpdatedAt =
    body?.base_updated_at == null ? null : Number(body.base_updated_at)
  const existing = await getSnapshot(db, userId)
  const remoteUpdatedAt = existing ? Number(existing.updated_at || 0) : 0

  if (existing && baseUpdatedAt != null && baseUpdatedAt !== remoteUpdatedAt) {
    let remotePayload = null
    try {
      remotePayload = JSON.parse(String(existing.payload || "{}"))
    } catch {
      remotePayload = null
    }
    return jsonResponse(
      {
        error: "conflict",
        message: "На сервере более новая версия — сначала скачайте или выберите замену",
        updated_at: remoteUpdatedAt,
        payload: remotePayload
      },
      409
    )
  }

  const updatedAt = Date.now()
  const cid = clientId(request.headers)
  const serialized = JSON.stringify(payload)
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "too-large", message: "Слишком большой бэкап для синка" }, 413)
  }

  await upsertSnapshot(db, {
    userId,
    payload: serialized,
    updatedAt,
    clientId: cid || null
  })

  return jsonResponse({ updated_at: updatedAt, ok: true })
}
