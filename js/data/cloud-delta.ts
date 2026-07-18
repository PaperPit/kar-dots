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
    upsertSrsMeta(meta, row)
    const at = Number((row as { updated_at?: number }).updated_at) || 0
    if (at > maxAt) maxAt = at
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
