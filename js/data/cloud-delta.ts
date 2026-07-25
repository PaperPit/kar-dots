import { upsertSrsMeta, SRS_FIELDS, type SrsMeta } from "./srs-meta.js"
import type { SrsRow } from "../lib/srs.js"

export const CLOUD_SYNC_KEY = "cloud_sync"

/** Periodic full cards pull even when watermark looks fresh (catches delete+create count ties). */
export const FULL_RESYNC_MS = 24 * 60 * 60 * 1000

export const SRS_DELTA_SELECT = SRS_FIELDS + ",updated_at"

interface CloudSyncState {
  userId?: string
  cardsAt?: number
  fullAt?: number
}

/**
 * Whether cards can be refreshed via updated_at=gt.watermark instead of full select.
 */
export function shouldUseCardsDelta(sync: CloudSyncState | null | undefined, uid: string | null, now = Date.now()): boolean {
  if (!sync || !uid || sync.userId !== uid) return false
  if (!(sync.cardsAt && sync.cardsAt > 0)) return false
  if (now - (sync.fullAt || 0) > FULL_RESYNC_MS) return false
  return true
}

/**
 * Upsert delta card rows into a copy of base srs_meta.
 * @returns {{ meta: SrsMeta[], maxAt: number }}
 */
export function mergeSrsDelta(base: SrsMeta[] | null | undefined, deltaRows: SrsRow[] | null | undefined): { meta: SrsMeta[]; maxAt: number } {
  const meta = (base || []).slice()
  let maxAt = 0
  for (const row of deltaRows || []) {
    const incoming = row as SrsRow & { updated_at?: number }
    const at = Number(incoming.updated_at) || 0
    if (at > maxAt) maxAt = at
    const i = meta.findIndex((c) => c.id === incoming.id)
    if (i >= 0) {
      const prevAt = Number((meta[i] as SrsMeta & { updated_at?: number }).updated_at) || 0
      // Не затирать локально более новую версию более старым delta-рядом.
      if (at > 0 && prevAt > at) continue
    }
    upsertSrsMeta(meta, incoming)
    if (i >= 0 || meta.find((c) => c.id === incoming.id)) {
      const slot = meta.find((c) => c.id === incoming.id) as SrsMeta & { updated_at?: number } | undefined
      if (slot && at > 0) slot.updated_at = Math.max(Number(slot.updated_at) || 0, at)
    }
  }
  return { meta, maxAt }
}

/** Next watermark after a cards pull. */
export function nextCardsWatermark(prevAt: number | null | undefined, maxAtFromRows: number | null | undefined, now = Date.now()): number {
  const prev = Number(prevAt) || 0
  const fromRows = Number(maxAtFromRows) || 0
  if (fromRows > prev) return fromRows
  return Math.max(prev, now)
}

export function stampUpdatedAt<T extends Record<string, unknown>>(patch: T = {} as T): T & { updated_at: number } {
  return Object.assign({}, patch, { updated_at: Date.now() })
}

/**
 * PostgREST filter for last-write-wins / optimistic concurrency.
 *
 * Prefer `baseUpdatedAt` (значение updated_at до локального stamp): PATCH
 * проходит только если на сервере всё ещё та же версия (`eq`).
 * Иначе старое устройство не затрёт правки с ноутбука.
 *
 * Без base (старые элементы очереди) — fallback `updated_at=lt.<наш stamp>`.
 */
export function lwwUpdateFilter(
  id: string,
  patch: { updated_at?: number } | null | undefined,
  baseUpdatedAt?: number | null
): string {
  if (baseUpdatedAt != null && Number.isFinite(Number(baseUpdatedAt))) {
    return "id=eq." + id + "&updated_at=eq." + Number(baseUpdatedAt)
  }
  const at = Number(patch?.updated_at) || 0
  if (!(at > 0)) return "id=eq." + id
  return "id=eq." + id + "&updated_at=lt." + at
}

/** Сообщение для dead letter при 0 затронутых строк (OCC/LWW miss). */
export const LWW_CONFLICT_MESSAGE =
  "Конфликт синхронизации: на сервере более новая версия"

/** Keep the side with the greater updated_at (tie → prefer remote). */
export function pickNewerByUpdatedAt<T extends { updated_at?: number | null }>(
  local: T | null | undefined,
  remote: T | null | undefined
): T | null {
  if (!local) return remote ?? null
  if (!remote) return local
  const la = Number(local.updated_at) || 0
  const ra = Number(remote.updated_at) || 0
  return ra >= la ? remote : local
}

/**
 * Settings LWW: remote wins only if its stamp is >= local.
 * Returns which blob to keep and the winning stamp.
 */
export function resolveSettingsLww(
  local: Record<string, unknown> | null | undefined,
  localAt: number,
  remote: Record<string, unknown> | null | undefined,
  remoteAt: number
): { data: Record<string, unknown> | null; updatedAt: number; source: "local" | "remote" | "none" } {
  const la = Number(localAt) || 0
  const ra = Number(remoteAt) || 0
  if (!remote && !local) return { data: null, updatedAt: 0, source: "none" }
  if (!remote) return { data: local || null, updatedAt: la, source: "local" }
  if (!local) return { data: remote, updatedAt: ra, source: "remote" }
  if (ra >= la) return { data: remote, updatedAt: ra, source: "remote" }
  return { data: local, updatedAt: la, source: "local" }
}
