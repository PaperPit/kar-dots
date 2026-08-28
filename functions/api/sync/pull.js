// GET /api/sync/pull?since=<ms> — дельта snapshot (фаза 2: полный JSON v3).

import { getSnapshot, jsonResponse, syncDb } from "../lib/_cf-sync.js"

export async function onRequestGet(context) {
  return handlePull(context.request, context.env, context.data)
}

export async function _handlerForTests(request, env, data = {}) {
  return handlePull(request, env, data)
}

async function handlePull(request, env, data) {
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

  const url = new URL(request.url)
  const since = Number(url.searchParams.get("since") || 0)
  const snap = await getSnapshot(db, userId)
  if (!snap) {
    return jsonResponse({ updated_at: 0, payload: null })
  }

  const updatedAt = Number(snap.updated_at || 0)
  if (updatedAt <= since) {
    return jsonResponse({ updated_at: updatedAt, payload: null })
  }

  let payload = null
  try {
    payload = JSON.parse(String(snap.payload || "{}"))
  } catch {
    console.error("[sync/pull] corrupt payload for", userId)
    return jsonResponse({ error: "corrupt-payload", message: "Повреждённые данные на сервере" }, 500)
  }

  return jsonResponse({
    updated_at: updatedAt,
    payload,
    client_id: snap.client_id || null
  })
}
