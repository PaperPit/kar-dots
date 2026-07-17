import { upsertSrsMeta, SRS_FIELDS } from './srs-meta.js';

export const CLOUD_SYNC_KEY = 'cloud_sync';

/** Periodic full cards pull even when watermark looks fresh (catches delete+create count ties). */
export const FULL_RESYNC_MS = 24 * 60 * 60 * 1000;

export const SRS_DELTA_SELECT = SRS_FIELDS + ',updated_at';

/**
 * Whether cards can be refreshed via updated_at=gt.watermark instead of full select.
 * @param {{ userId?: string, cardsAt?: number, fullAt?: number }|null|undefined} sync
 * @param {string|null} uid
 * @param {number} [now]
 */
export function shouldUseCardsDelta(sync, uid, now = Date.now()) {
  if (!sync || !uid || sync.userId !== uid) return false;
  if (!(sync.cardsAt > 0)) return false;
  if (now - (sync.fullAt || 0) > FULL_RESYNC_MS) return false;
  return true;
}

/**
 * Upsert delta card rows into a copy of base srs_meta.
 * @returns {{ meta: Object[], maxAt: number }}
 */
export function mergeSrsDelta(base, deltaRows) {
  const meta = (base || []).slice();
  let maxAt = 0;
  for (const row of deltaRows || []) {
    upsertSrsMeta(meta, row);
    const at = Number(row.updated_at) || 0;
    if (at > maxAt) maxAt = at;
  }
  return { meta, maxAt };
}

/** Next watermark after a cards pull. */
export function nextCardsWatermark(prevAt, maxAtFromRows, now = Date.now()) {
  const prev = Number(prevAt) || 0;
  const fromRows = Number(maxAtFromRows) || 0;
  if (fromRows > prev) return fromRows;
  return Math.max(prev, now);
}

export function stampUpdatedAt(patch = {}) {
  return Object.assign({}, patch, { updated_at: Date.now() });
}
