import { isNetworkError } from './supabase.js'
import { setActivityCloudSync } from '../lib/activity.js'
import {
  setReviewLogCloudSync,
  lastReviewTs,
  applyRemoteReviews,
  type ReviewLogEntry,
} from '../lib/review-log.js'
import { executeSyncItem, isReviewLogMissing, saveCloudFlags } from './cloud-remote.js'
import {
  fetchFromCloud,
  ingestRemoteActivity,
  pushActivityToCloud,
} from './cloud-pull.js'
import type { CloudStoreHost } from './cloud-store-host.js'

export async function notifySync(store: CloudStoreHost) {
  if (!store._onSyncChange) return
  store._onSyncChange({
    pending: await pendingSync(store),
    failed: await deadLetterCount(store),
    offline: store._offline,
  })
}

export async function pendingSync(store: CloudStoreHost) {
  if (!store.queue.db) return 0
  return store.queue.size()
}

export async function deadLetterCount(store: CloudStoreHost) {
  if (!store.queue.db) return 0
  return store.queue.deadLetterCount()
}

export async function deadLetters(store: CloudStoreHost) {
  if (!store.queue.db) return []
  return store.queue.deadLetters()
}

export async function retryDeadLetter(store: CloudStoreHost, id: number) {
  if (!store.queue.db) return false
  const ok = await store.queue.retryDeadLetter(id)
  if (ok) await flushSync(store)
  await notifySync(store)
  return ok
}

export async function discardDeadLetter(store: CloudStoreHost, id: number) {
  if (!store.queue.db) return false
  const ok = await store.queue.discardDeadLetter(id)
  await notifySync(store)
  return ok
}

export async function flushSync(store: CloudStoreHost) {
  const r = await store.queue.flush()
  if (r.ok > 0 || r.fail > 0) await notifySync(store)
  return r
}

export async function onOnline(store: CloudStoreHost) {
  store._offline = false
  await flushSync(store)
  try {
    await fetchFromCloud(store)
    await notifySync(store)
    store._emitDataChange()
  } catch (e) { /* mirror */ }
}

/**
 * Apply localFn first. Online: wait for cloud unless `optimistic` (UI returns after
 * mirror; network runs in a serialized background chain). Offline / network error → queue.
 */
export async function cloudOrQueue(
  store: CloudStoreHost,
  op: string,
  payload: unknown,
  localFn: () => Promise<unknown>,
  { optimistic = false }: { optimistic?: boolean } = {},
) {
  const result = await localFn()
  if (!navigator.onLine) {
    store._offline = true
    await store.queue.enqueue({ op, payload })
    await notifySync(store)
    return result
  }
  if (optimistic) {
    syncInBackground(store, op, payload)
    return result
  }
  try {
    await executeSyncItem(store, { op, payload: payload as any })
    store._offline = false
    return result
  } catch (e) {
    if (isNetworkError(e)) {
      store._offline = true
      await store.queue.enqueue({ op, payload })
      await notifySync(store)
      return result
    }
    throw e
  }
}

/** Serialized fire-and-forget cloud op; on failure falls back to SyncQueue. */
export function syncInBackground(store: CloudStoreHost, op: string, payload: unknown) {
  const run = async () => {
    try {
      await executeSyncItem(store, { op, payload: payload as any })
      store._offline = false
    } catch (e) {
      if (isNetworkError(e)) {
        store._offline = true
        await store.queue.enqueue({ op, payload })
        await notifySync(store)
        return
      }
      await store.queue.enqueue({ op, payload })
      await notifySync(store)
      try { await flushSync(store) } catch (_) { /* dead-letter / still pending */ }
    }
  }
  store._bgSyncTail = store._bgSyncTail.then(run, run)
}

export function bindActivityCloudSync(store: CloudStoreHost) {
  setActivityCloudSync((data) => {
    if (store._activityPushTimer) clearTimeout(store._activityPushTimer)
    store._activityPushTimer = setTimeout(() => {
      store._activityPushTimer = null
      void pushActivityToCloud(store, data)
    }, 1000)
  })
}

export function bindReviewLogCloudSync(store: CloudStoreHost) {
  setReviewLogCloudSync({
    push: (entry) => { void store.queue.enqueue({ op: 'logReview', payload: entry }).then(() => flushSync(store)) },
    remove: (id) => { void store.queue.enqueue({ op: 'removeReview', payload: { id } }).then(() => flushSync(store)) },
  })
}

export async function syncActivityNow(store: CloudStoreHost) {
  if (store._activityPushTimer) {
    clearTimeout(store._activityPushTimer)
    store._activityPushTimer = null
  }
  const changed = await ingestRemoteActivity(store)
  if (changed) store._emitDataChange()
  return changed
}

export async function syncReviewLogFromCloud(store: CloudStoreHost): Promise<number> {
  if (store._reviewLogCloudUnsupported || !store.sb.userId()) return 0
  try {
    const since = await lastReviewTs()
    const rows = await store.sb.select<ReviewLogEntry>(
      'review_log',
      'select=*&ts=gt.' + since + '&order=ts.asc&limit=5000'
    )
    return await applyRemoteReviews(rows)
  } catch (e) {
    if (isReviewLogMissing(e)) { store._reviewLogCloudUnsupported = true; await saveCloudFlags(store); return 0 }
    if (isNetworkError(e)) return 0
    console.warn('review-log pull', e)
    return 0
  }
}

export { pushActivityToCloud, ingestRemoteActivity }
