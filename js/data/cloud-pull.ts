import { isNetworkError } from './supabase.js'
import {
  getAll, mirrorReplaceAll, mirrorGetKV, mirrorSetKV,
} from './sync-queue.js'
import { DEFAULT_SETTINGS } from './store-common.js'
import { normalizeFolderRecord, normalizeBoxRecord } from '../lib/folder-icons.js'
import { countSrsMetaByFolder } from './srs-meta.js'
import { invalidateDerivedCaches } from './cache-invalidate.js'
import {
  CLOUD_SYNC_KEY, SRS_DELTA_SELECT, shouldUseCardsDelta, mergeSrsDelta,
  nextCardsWatermark,
} from './cloud-delta.js'
import {
  applyRemoteActivity, loadActivity, type ActivityData,
} from '../lib/activity.js'
import { isMissingBoxesTableError } from '../lib/folder-errors.js'
import { saveCloudFlags } from './cloud-remote.js'
import type { Folder, Box, Settings } from './types.js'
import type { SrsMeta } from './srs-meta.js'
import type { CloudStoreHost } from './cloud-store-host.js'

export async function pushActivityToCloud(store: CloudStoreHost, data: ActivityData) {
  try {
    store.settings.activity = data
    await store.saveSettings(store.settings)
  } catch (e) {
    console.warn('activity cloud push', e)
  }
}

/** Слить activity из settings с локальной; если на устройстве больше — отправить в облако. */
export async function ingestRemoteActivity(store: CloudStoreHost) {
  const remote = store.settings.activity
  const changed = await applyRemoteActivity(remote)
  const local = loadActivity()
  if (JSON.stringify(local) !== JSON.stringify(remote || { days: {} })) {
    await pushActivityToCloud(store, local)
  }
  return changed
}

export async function pullCardsFull(store: CloudStoreHost) {
  const rows = await store.sb.select('cards', 'select=' + SRS_DELTA_SELECT)
  const { meta, maxAt } = mergeSrsDelta([], rows)
  return { meta, cardsAt: nextCardsWatermark(0, maxAt), full: true }
}

/**
 * Pull only cards with updated_at > since, merge into mirror srs_meta.
 * Falls back to full when remote count disagrees (deletes) or query fails.
 */
export async function pullCardsDelta(store: CloudStoreHost, uid: string, since: number) {
  try {
    const base = store._srsMeta
      || (await mirrorGetKV(store.mirror, 'srs_meta'))
      || []
    const [delta, remoteCount] = await Promise.all([
      store.sb.select(
        'cards',
        'user_id=eq.' + uid + '&updated_at=gt.' + since + '&select=' + SRS_DELTA_SELECT,
      ),
      store.sb.count('cards', 'user_id=eq.' + uid),
    ])
    const { meta, maxAt } = mergeSrsDelta(base as SrsMeta[] | null | undefined, delta)
    if (remoteCount !== meta.length) return pullCardsFull(store)
    return {
      meta,
      cardsAt: nextCardsWatermark(since, maxAt),
      full: false,
    }
  } catch (e) {
    if (isNetworkError(e)) throw e
    return pullCardsFull(store)
  }
}

export async function fetchBoxesFromCloud(store: CloudStoreHost) {
  try {
    const rows = await store.sb.select<Box>('boxes', 'select=*&order=created_at.asc')
    if (store._compat.boxes) {
      store._compat.boxes = false
      await saveCloudFlags(store)
    }
    return rows
  } catch (e) {
    if (isMissingBoxesTableError(e)) {
      store._compat.boxes = true
      await saveCloudFlags(store)
    }
    try {
      if (store.mirror) return await getAll<Box>(store.mirror, 'boxes')
    } catch (e2) { /* mirror empty */ }
    return []
  }
}

export async function loadFromMirror(store: CloudStoreHost) {
  store.folders = ((await getAll(store.mirror, 'folders')) as (Folder | null | undefined)[])
    .map(normalizeFolderRecord).filter((f): f is Folder => !!f)
  store.folders.sort((a: Folder, b: Folder) => (a.created_at || 0) - (b.created_at || 0))
  store.boxes = ((await getAll(store.mirror, 'boxes')) as (Box | null | undefined)[])
    .map(normalizeBoxRecord).filter((b): b is Box => !!b)
  store.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
  const settings = await mirrorGetKV(store.mirror, 'settings')
  if (settings) store.settings = Object.assign({}, DEFAULT_SETTINGS, settings as Partial<Settings>)
  await ingestRemoteActivity(store)
  const meta = await mirrorGetKV(store.mirror, 'srs_meta')
  store._srsMeta = (meta as SrsMeta[] | null) || []
  store._cache.clearAll()
  store._cache.rebuildCountsFromSrsMeta(store.folders, store._srsMeta)
  store._offline = true
}

export async function fetchFromCloud(store: CloudStoreHost) {
  const uid = store.sb.userId()
  if (!uid) throw new Error('Нет активной сессии')
  const sync = (await mirrorGetKV(store.mirror, CLOUD_SYNC_KEY)) as { fullAt?: number; cardsAt?: number } | null
  const useDelta = shouldUseCardsDelta(sync, uid)

  const [folders, settingsRows, boxesRaw, cardsPull] = await Promise.all([
    store.sb.select<Folder>('folders', 'select=*&order=created_at.asc'),
    store.sb.select<{ data?: Settings }>('settings', 'select=*&user_id=eq.' + uid),
    fetchBoxesFromCloud(store),
    useDelta ? pullCardsDelta(store, uid, sync?.cardsAt ?? Date.now()) : pullCardsFull(store),
  ])

  store.folders = folders.map(normalizeFolderRecord).filter((f): f is Folder => !!f)
  store.boxes = boxesRaw.map(normalizeBoxRecord).filter((b): b is Box => !!b)
    .sort((a: Box, b: Box) => (a.created_at || 0) - (b.created_at || 0))
  if (folders.some((f: Folder) => Object.prototype.hasOwnProperty.call(f, 'icon'))) {
    store._compat.folderIcon = false
    await saveCloudFlags(store)
  }
  await mirrorReplaceAll(store.mirror, 'folders', folders)
  await mirrorReplaceAll(store.mirror, 'boxes', store.boxes)
  store._srsMeta = cardsPull.meta
  store._cache.clearAll()
  for (const [fid, n] of countSrsMetaByFolder(cardsPull.meta, folders)) {
    store._cache.setCount(fid, n)
  }
  invalidateDerivedCaches(store)
  const settingsRow = settingsRows[0]
  if (settingsRow?.data) {
    store.settings = Object.assign({}, DEFAULT_SETTINGS, settingsRow.data)
  }
  await mirrorSetKV(store.mirror, 'settings', store.settings)
  await ingestRemoteActivity(store)
  await mirrorSetKV(store.mirror, 'srs_meta', cardsPull.meta)
  const now = Date.now()
  await mirrorSetKV(store.mirror, CLOUD_SYNC_KEY, {
    userId: uid,
    cardsAt: cardsPull.cardsAt,
    fullAt: cardsPull.full ? now : (sync?.fullAt ?? now),
  })
  store._offline = false
}

/** Догружает данные из облака в фоне и обновляет UI, не блокируя первый экран. */
export function syncFromCloudInBackground(
  store: CloudStoreHost,
  flushSync: (s: CloudStoreHost) => Promise<unknown>,
  notifySync: (s: CloudStoreHost) => Promise<void>,
) {
  const run = (async () => {
    try {
      await fetchFromCloud(store)
      store._offline = false
      await flushSync(store)
      await notifySync(store)
      store._emitDataChange()
    } catch (e) {
      if (isNetworkError(e)) { store._offline = true; await notifySync(store) }
      else console.error('Фоновая синхронизация не удалась:', e)
    }
  })()
  store._cloudSyncPromise = run.finally(() => {
    if (store._cloudSyncPromise === run) store._cloudSyncPromise = null
  })
}

export async function loadData(
  store: CloudStoreHost,
  flushSync: (s: CloudStoreHost) => Promise<unknown>,
  notifySync: (s: CloudStoreHost) => Promise<void>,
) {
  await loadFromMirror(store)
  store._offline = !navigator.onLine
  if (navigator.onLine) syncFromCloudInBackground(store, flushSync, notifySync)
  await notifySync(store)
  if (store.settings.algo === 'fsrs') {
    const { preloadFsrs } = await import('../lib/srs.js')
    preloadFsrs()
  }
}

/**
 * Дождаться текущей (или только что запущенной) синхронизации с облаком.
 * Нужно при первом входе, когда зеркало пустое — иначе home рисуется без папок.
 */
export async function whenCloudReady(
  store: CloudStoreHost,
  flushSync: (s: CloudStoreHost) => Promise<unknown>,
  notifySync: (s: CloudStoreHost) => Promise<void>,
) {
  if (store._cloudSyncPromise) {
    await store._cloudSyncPromise
    return
  }
  if (!navigator.onLine) return
  syncFromCloudInBackground(store, flushSync, notifySync)
  if (store._cloudSyncPromise) await store._cloudSyncPromise
}
