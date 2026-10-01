// ============================================================
// КАР-точки — ссылки на картинки (R2 / data: / legacy)
// ============================================================

import { cfLoggedIn } from "./cf-auth.js"
import { cfSignFileUrl, isR2Ref, r2KeyFromRef } from "./cf-files.js"

/** Срок жизни подписи, секунды (совпадает с сервером). */
export const SIGNED_TTL_SEC = 60 * 60

/** За сколько до конца срока считаем подпись протухшей. */
export const REFRESH_MARGIN_MS = 60 * 1000

/** @deprecated legacy Supabase bucket name — только для старых URL в импортах */
export const IMAGE_BUCKET = "card-images"

export interface SignedEntry {
  url: string
  expiresAt: number
}

const cache = new Map<string, SignedEntry>()
const inflight = new Map<string, Promise<string>>()

/** No-op stub: formerly wired MiniSupabase; kept so call sites compile. */
export function configureImageUrls(_sb: unknown = null) {
  clearImageUrlCache()
}

export function clearImageUrlCache() {
  cache.clear()
  inflight.clear()
}

/** Legacy Supabase public URL parser — returns null for non-Supabase URLs. */
export function parseStorageUrl(
  url: string | null | undefined,
  base = ""
): { bucket: string; path: string } | null {
  const raw = String(url || "")
  if (!raw || /^data:/i.test(raw) || /^blob:/i.test(raw)) return null
  if (!/^https:\/\//i.test(raw)) return null
  if (!base) return null
  const PUBLIC_MARKER = "/storage/v1/object/public/"
  const prefix = base.replace(/\/+$/, "") + PUBLIC_MARKER
  if (!raw.startsWith(prefix)) return null
  const rest = raw.slice(prefix.length).split("?")[0] || ""
  const slash = rest.indexOf("/")
  if (slash <= 0 || slash === rest.length - 1) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

export function isSignedFresh(entry: SignedEntry | null | undefined, now = Date.now()): boolean {
  if (!entry || !entry.url) return false
  return entry.expiresAt - REFRESH_MARGIN_MS > now
}

export function resolveImageUrlSync(url: string | null | undefined): string {
  const raw = String(url || "")
  if (!isR2Ref(raw)) return raw
  const key = r2KeyFromRef(raw)
  if (!key) return raw
  const entry = cache.get(key)
  return isSignedFresh(entry) ? entry!.url : raw
}

export async function resolveImageUrl(url: string | null | undefined): Promise<string> {
  const raw = String(url || "")
  if (!isR2Ref(raw)) return raw
  const key = r2KeyFromRef(raw)
  if (!key) return raw

  const entry = cache.get(key)
  if (isSignedFresh(entry)) return entry!.url

  if (!cfLoggedIn()) return raw

  const running = inflight.get(key)
  if (running) return running

  const task = (async () => {
    try {
      const signed = await cfSignFileUrl(key)
      if (signed) {
        cache.set(key, { url: signed, expiresAt: Date.now() + SIGNED_TTL_SEC * 1000 })
        return signed
      }
      return raw
    } catch (e) {
      console.warn("[images] CF sign failed:", e instanceof Error ? e.message : e)
      return raw
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, task)
  return task
}

export async function resolveImageUrls(urls: (string | null | undefined)[]): Promise<string[]> {
  return Promise.all((urls || []).map((u) => resolveImageUrl(u)))
}
