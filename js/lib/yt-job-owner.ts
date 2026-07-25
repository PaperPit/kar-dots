/**
 * Владелец YouTube-джоба в KV: Supabase user id или стабильный анонимный UUID.
 * Передаётся в /api/yt-video вместе с jobId — сервер кладёт ключ job:${userId}:${jobId}.
 */

import { sb } from "../core/state.js"

const LS_KEY = "kar_yt_job_user"
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isYtJobUserId(raw: unknown): boolean {
  return UUID_RE.test(String(raw || "").trim())
}

function anonymousOwnerId(): string {
  try {
    let id = localStorage.getItem(LS_KEY)
    if (!id || !UUID_RE.test(id)) {
      id = crypto.randomUUID()
      localStorage.setItem(LS_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

/** UUID для POST/GET /api/yt-video (облачный аккаунт или локальный аноним). */
export function getYtJobUserId(): string {
  const uid = sb?.userId?.()
  if (uid && isYtJobUserId(uid)) return uid
  return anonymousOwnerId()
}
