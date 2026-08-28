/**
 * Cloudflare snapshot sync — push/pull export JSON v3 (фаза 2).
 */

import { apiErrorMessage } from "../lib/api-client.js"
import { validateImportJSON } from "./store-contract.js"
import type { AppStore } from "../core/state.js"
import { cfApiHeaders, cfLastSyncAt, cfLoggedIn, cfSetLastSyncAt } from "./cf-auth.js"

export type CfSyncResult =
  | { status: "pushed"; updated_at: number }
  | { status: "pulled"; updated_at: number }
  | { status: "unchanged" }
  | { status: "conflict"; remote_updated_at: number }

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  return data
}

export async function cfPullSnapshot(since = cfLastSyncAt()): Promise<{
  updated_at: number
  payload: Record<string, unknown> | null
}> {
  const res = await fetch(`/api/sync/pull?since=${encodeURIComponent(String(since))}`, {
    headers: await cfApiHeaders()
  })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(res.status, data.message || data.error))
  }
  const updated_at = Number(data.updated_at || 0)
  const payload =
    data.payload && typeof data.payload === "object"
      ? (data.payload as Record<string, unknown>)
      : null
  return { updated_at, payload }
}

export async function cfPushSnapshot(
  payload: Record<string, unknown>,
  baseUpdatedAt: number | null
): Promise<{ updated_at: number }> {
  const res = await fetch("/api/sync/push", {
    method: "POST",
    headers: await cfApiHeaders(),
    body: JSON.stringify({
      payload,
      base_updated_at: baseUpdatedAt
    })
  })
  const data = await parseJson(res)
  if (res.status === 409) {
    const err = new Error(
      apiErrorMessage(409, data.message || "conflict")
    ) as Error & { code?: string; remote?: unknown; remote_updated_at?: number }
    err.code = "conflict"
    err.remote = data.payload
    err.remote_updated_at = Number(data.updated_at || 0)
    throw err
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(res.status, data.message || data.error))
  }
  return { updated_at: Number(data.updated_at || Date.now()) }
}

export async function cfImportPayload(store: AppStore, payload: Record<string, unknown>): Promise<void> {
  validateImportJSON(payload)
  await store.importJSON(JSON.stringify(payload))
}

/** Скачать облако в локальный store (с подтверждением снаружи). */
export async function cfPullIntoStore(store: AppStore): Promise<number> {
  const { updated_at, payload } = await cfPullSnapshot(0)
  if (!payload) return updated_at
  await cfImportPayload(store, payload)
  cfSetLastSyncAt(updated_at)
  return updated_at
}

/** Загрузить локальные данные в облако. */
export async function cfPushFromStore(store: AppStore): Promise<number> {
  const text = await store.exportJSONFull()
  const payload = JSON.parse(text) as Record<string, unknown>
  validateImportJSON(payload)
  const base = cfLastSyncAt() || null
  const { updated_at } = await cfPushSnapshot(payload, base)
  cfSetLastSyncAt(updated_at)
  return updated_at
}

/**
 * Умный sync: если на сервере новее — pull; иначе push.
 * При конфликте base_updated_at бросает Error с code=conflict.
 */
export async function cfSyncNow(store: AppStore): Promise<CfSyncResult> {
  if (!cfLoggedIn()) throw new Error("Not logged in")

  const localSince = cfLastSyncAt()
  const remote = await cfPullSnapshot(localSince)

  if (remote.payload) {
    await cfImportPayload(store, remote.payload)
    cfSetLastSyncAt(remote.updated_at)
    return { status: "pulled", updated_at: remote.updated_at }
  }

  const hasLocal =
    store.folders.length > 0 || store.boxes.length > 0 || (await store.countCards()) > 0

  if (!hasLocal && remote.updated_at === 0) {
    return { status: "unchanged" }
  }

  try {
    const updated_at = await cfPushFromStore(store)
    return { status: "pushed", updated_at }
  } catch (e) {
    const err = e as Error & { code?: string; remote_updated_at?: number }
    if (err.code === "conflict") {
      return {
        status: "conflict",
        remote_updated_at: Number(err.remote_updated_at || remote.updated_at || 0)
      }
    }
    throw e
  }
}
