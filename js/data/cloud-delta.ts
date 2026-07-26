import { upsertSrsMeta, SRS_FIELDS, type SrsMeta } from "./srs-meta.js"
import type { SrsRow } from "../lib/srs.js"

export const CLOUD_SYNC_KEY = "cloud_sync"

/** Periodic full cards pull even when watermark looks fresh (catches delete+create count ties). */
export const FULL_RESYNC_MS = 24 * 60 * 60 * 1000

export const SRS_DELTA_SELECT = SRS_FIELDS + ",updated_at"

/** Серверная отметка времени записи (ставит триггер, миграция 0011). */
export const SYNCED_AT_FIELD = "synced_at"

/** Проекция дельта-синка, когда в схеме уже есть synced_at. */
export const SYNCED_DELTA_SELECT = SRS_DELTA_SELECT + "," + SYNCED_AT_FIELD

/** По каким часам построен watermark: серверным (synced_at) или клиентским (updated_at). */
export type WatermarkKind = "synced_at" | "updated_at"

/**
 * Запас для серверного watermark: строка могла быть записана уже после того,
 * как наш SELECT увидел снимок данных, но с меткой чуть меньше максимальной.
 */
export const WATERMARK_SAFETY_MS = 5000

/**
 * Запас для устаревшей схемы без synced_at. Метки там клиентские, поэтому
 * правка с чужого устройства может приехать «в прошлое» — окно дельты держим
 * заведомо шире реального перекоса часов между устройствами.
 */
export const LEGACY_WATERMARK_SAFETY_MS = 10 * 60 * 1000

interface CloudSyncState {
  userId?: string
  cardsAt?: number
  cardsAtKind?: WatermarkKind
  fullAt?: number
}

/**
 * Whether cards can be refreshed via <watermark field>=gt.watermark instead of full select.
 * Смена вида часов (появился/пропал synced_at) обесценивает старый watermark —
 * значения несравнимы, поэтому такой переход требует полной выборки.
 */
export function shouldUseCardsDelta(
  sync: CloudSyncState | null | undefined,
  uid: string | null,
  now = Date.now(),
  kind: WatermarkKind = "updated_at"
): boolean {
  if (!sync || !uid || sync.userId !== uid) return false
  if (!(sync.cardsAt && sync.cardsAt > 0)) return false
  if ((sync.cardsAtKind || "updated_at") !== kind) return false
  if (now - (sync.fullAt || 0) > FULL_RESYNC_MS) return false
  return true
}

/**
 * Upsert delta card rows into a copy of base srs_meta.
 * @returns {{ meta: SrsMeta[], maxAt: number, maxSyncedAt: number }}
 */
export function mergeSrsDelta(
  base: SrsMeta[] | null | undefined,
  deltaRows: SrsRow[] | null | undefined
): { meta: SrsMeta[]; maxAt: number; maxSyncedAt: number } {
  const meta = (base || []).slice()
  let maxAt = 0
  let maxSyncedAt = 0
  for (const row of deltaRows || []) {
    upsertSrsMeta(meta, row)
    const at = Number((row as { updated_at?: number }).updated_at) || 0
    if (at > maxAt) maxAt = at
    const syncedAt = Number((row as { synced_at?: number }).synced_at) || 0
    if (syncedAt > maxSyncedAt) maxSyncedAt = syncedAt
  }
  return { meta, maxAt, maxSyncedAt }
}

/**
 * Next watermark after a cards pull.
 *
 * Часы устройства здесь не участвуют вообще: watermark двигается только по
 * меткам реально полученных строк. Иначе пустая выборка задирала бы его до
 * «сейчас», и правка, сделанная офлайн (или на устройстве с отставшими
 * часами), навсегда оставалась бы «раньше» watermark — её не привозила бы ни
 * дельта, ни сверка количества (та ловит только вставки и удаления).
 */
export function nextCardsWatermark(
  prevAt: number | null | undefined,
  maxAtFromRows: number | null | undefined,
  { kind = "updated_at", safetyMs }: { kind?: WatermarkKind; safetyMs?: number } = {}
): number {
  const prev = Number(prevAt) || 0
  const fromRows = Number(maxAtFromRows) || 0
  if (fromRows <= 0) return prev
  const safety =
    safetyMs ?? (kind === "synced_at" ? WATERMARK_SAFETY_MS : LEGACY_WATERMARK_SAFETY_MS)
  return Math.max(prev, fromRows - safety)
}

export function stampUpdatedAt<T extends Record<string, unknown>>(patch: T = {} as T): T & { updated_at: number } {
  return Object.assign({}, patch, { updated_at: Date.now() })
}

/**
 * Фильтр PATCH-а карточки: last-write-wins по клиентскому времени правки.
 * Сервер применит патч, только если сохранённая версия старше нашей —
 * иначе застрявшая в офлайн-очереди правка молча затрёт более свежую с
 * другого устройства.
 */
export function cardLwwFilter(id: string, patch: Record<string, unknown> | null | undefined): string {
  const base = "id=eq." + id
  const at = Number((patch as { updated_at?: unknown } | null | undefined)?.updated_at)
  if (!Number.isFinite(at) || at <= 0) return base
  return base + "&updated_at=lt." + at
}

/** Ошибка «колонки synced_at ещё нет» (пользователь не применил миграцию 0011). */
export function isMissingSyncedAtError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (!/synced_at/i.test(msg)) return false
  return /does not exist|42703|schema cache|could not find/i.test(msg)
}
