/**
 * Cloudflare R2 files — upload + signed URL resolve.
 */

import { apiErrorMessage } from "../lib/api-client.js"
import { cfApiHeaders, cfLoggedIn, cfToken } from "./cf-auth.js"
import { getYtJobUserId } from "../lib/yt-job-owner.js"

const R2_PREFIX = /^r2:/i

export function isR2Ref(url: string | null | undefined): boolean {
  const s = String(url || "")
  return R2_PREFIX.test(s) || /\/api\/files\?/i.test(s)
}

export function r2KeyFromRef(url: string | null | undefined): string {
  const s = String(url || "")
  if (R2_PREFIX.test(s)) return s.replace(R2_PREFIX, "").replace(/^\/+/, "")
  try {
    if (s.includes("/api/files")) {
      const u = new URL(s, location.origin)
      return String(u.searchParams.get("key") || "").replace(/^\/+/, "")
    }
  } catch {
    /* ignore */
  }
  return ""
}

/** Стабильная ссылка для хранения в карточке. */
export function toR2Ref(key: string): string {
  return "r2:" + String(key || "").replace(/^r2:/i, "").replace(/^\/+/, "")
}

export async function cfUploadImageBlob(blob: Blob): Promise<string> {
  if (!cfLoggedIn()) throw new Error("Not logged in to Cloudflare sync")
  const type = blob.type || "image/jpeg"
  const headers = await cfApiHeaders({ "content-type": type })
  delete (headers as Record<string, string>)["content-type"]
  headers["content-type"] = type

  const res = await fetch("/api/files", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + (cfToken() || ""),
      "X-Client-Id": getYtJobUserId(),
      "content-type": type
    },
    body: blob
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(res.status, data.message || data.error))
  }
  const ref = String(data.ref || "")
  if (!ref) throw new Error("Сервер не вернул ref файла")
  return ref
}

/** Получить подписанный URL для <img src>. */
export async function cfSignFileUrl(refOrKey: string): Promise<string> {
  const key = r2KeyFromRef(refOrKey) || String(refOrKey || "").replace(/^r2:/i, "")
  if (!key) return String(refOrKey || "")
  if (!cfLoggedIn()) {
    // Без сессии подписанный URL не получить — вернём как есть (может уже с sig).
    return String(refOrKey || "")
  }
  const res = await fetch(`/api/files?key=${encodeURIComponent(key)}&sign=1`, {
    headers: await cfApiHeaders()
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(res.status, data.message || data.error))
  }
  return String(data.url || "")
}

function isDataUrl(s: string): boolean {
  return /^data:/i.test(s)
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Перед push: заменить data: URL в cards на r2: refs.
 * Мутирует payload и локальный store при наличии updateCard.
 */
export async function migrateDataUrlsInPayload(
  store: {
    updateCard?: (id: string, patch: Record<string, unknown>) => Promise<unknown>
    cards?: unknown
  },
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!cfLoggedIn()) return payload
  const cards = Array.isArray(payload.cards) ? (payload.cards as Record<string, unknown>[]) : []
  const sides = ["front_img", "back_img"] as const

  for (const card of cards) {
    if (!card || typeof card !== "object") continue
    const id = String(card.id || "")
    const patch: Record<string, unknown> = {}
    for (const side of sides) {
      const val = String(card[side] || "")
      if (!isDataUrl(val)) continue
      try {
        const blob = await dataUrlToBlob(val)
        const ref = await cfUploadImageBlob(blob)
        card[side] = ref
        patch[side] = ref
      } catch (e) {
        console.warn("[cf-files] migrate data URL failed:", e)
      }
    }
    if (id && Object.keys(patch).length && typeof store.updateCard === "function") {
      try {
        await store.updateCard(id, patch)
      } catch (e) {
        console.warn("[cf-files] persist migrated refs failed:", e)
      }
    }
  }

  payload.cards = cards
  return payload
}
