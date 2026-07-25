import { isNetworkError } from './supabase.js'
import { mirrorGetKV, mirrorSetKV } from './sync-queue.js'
import { uuid } from './store-common.js'
import { resizeImage, blobToDataURL } from '../lib/image-utils.js'
import {
  isMissingFolderIconColumnError, isMissingBoxIdColumnError,
  isMissingBoxesTableError, isMissingBoxIconColumnError, withoutFolderIcon, withoutBoxId,
} from '../lib/folder-errors.js'
import { stampUpdatedAt } from './cloud-delta.js'
import type { Card, Folder, Box } from './types.js'
import type { ReviewLogEntry } from '../lib/review-log.js'
import type { CloudStoreHost, SyncPayload } from './cloud-store-host.js'

/** Ошибка «таблицы review_log ещё нет» (пользователь не применил миграцию 0008). */
export function isReviewLogMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /review_log|relation .*does not exist|PGRST205|42P01|42703|could not find the table|schema cache/i.test(msg)
}

export async function loadCloudFlags(store: CloudStoreHost) {
  if (!store.mirror) return
  const flags = (await mirrorGetKV(store.mirror, 'cloud_flags')) as {
    folderIconCloudUnsupported?: boolean
    boxesCloudUnsupported?: boolean
    boxIdCloudUnsupported?: boolean
    boxIconCloudUnsupported?: boolean
    reviewLogCloudUnsupported?: boolean
  } | null
  store._folderIconCloudUnsupported = !!flags?.folderIconCloudUnsupported
  store._boxesCloudUnsupported = !!flags?.boxesCloudUnsupported
  store._boxIdCloudUnsupported = !!flags?.boxIdCloudUnsupported
  store._boxIconCloudUnsupported = !!flags?.boxIconCloudUnsupported
  store._reviewLogCloudUnsupported = !!flags?.reviewLogCloudUnsupported
}

export async function saveCloudFlags(store: CloudStoreHost) {
  if (!store.mirror) return
  await mirrorSetKV(store.mirror, 'cloud_flags', {
    folderIconCloudUnsupported: !!store._folderIconCloudUnsupported,
    boxesCloudUnsupported: !!store._boxesCloudUnsupported,
    boxIdCloudUnsupported: !!store._boxIdCloudUnsupported,
    boxIconCloudUnsupported: !!store._boxIconCloudUnsupported,
    reviewLogCloudUnsupported: !!store._reviewLogCloudUnsupported,
  })
}

export async function cloudInsertFolder(store: CloudStoreHost, row: Folder) {
  let payload = row
  if (store._folderIconCloudUnsupported) payload = withoutFolderIcon(row)
  try {
    await store.sb.insert('folders', payload)
  } catch (e) {
    if (!store._folderIconCloudUnsupported && isMissingFolderIconColumnError(e) && row && 'icon' in row) {
      store._folderIconCloudUnsupported = true
      await saveCloudFlags(store)
      await store.sb.insert('folders', withoutFolderIcon(row))
      return
    }
    throw e
  }
}

export async function cloudPatchFolder(store: CloudStoreHost, id: string, patch: Partial<Folder>) {
  let payload = Object.assign({}, patch)
  if (store._folderIconCloudUnsupported) payload = withoutFolderIcon(payload)
  if (store._boxIdCloudUnsupported) payload = withoutBoxId(payload)
  if (!Object.keys(payload).length) return
  try {
    await store.sb.update('folders', 'id=eq.' + id, payload)
  } catch (e) {
    if (!store._folderIconCloudUnsupported && isMissingFolderIconColumnError(e) && patch && 'icon' in patch) {
      store._folderIconCloudUnsupported = true
      await saveCloudFlags(store)
      await cloudPatchFolder(store, id, withoutFolderIcon(patch))
      return
    }
    if (!store._boxIdCloudUnsupported && isMissingBoxIdColumnError(e) && patch && 'box_id' in patch) {
      store._boxIdCloudUnsupported = true
      await saveCloudFlags(store)
      await cloudPatchFolder(store, id, withoutBoxId(patch))
      return
    }
    throw e
  }
}

export async function cloudInsertBox(store: CloudStoreHost, row: Box) {
  if (store._boxesCloudUnsupported) return
  let payload = row
  if (store._boxIconCloudUnsupported) payload = withoutFolderIcon(row)
  try {
    await store.sb.insert('boxes', payload)
  } catch (e) {
    if (isMissingBoxesTableError(e)) {
      store._boxesCloudUnsupported = true
      await saveCloudFlags(store)
      return
    }
    if (!store._boxIconCloudUnsupported && isMissingBoxIconColumnError(e) && row && 'icon' in row) {
      store._boxIconCloudUnsupported = true
      await saveCloudFlags(store)
      await cloudInsertBox(store, withoutFolderIcon(row))
      return
    }
    throw e
  }
}

export async function cloudUpdateBox(store: CloudStoreHost, id: string, patch: Partial<Box>) {
  if (store._boxesCloudUnsupported) return
  let payload = Object.assign({}, patch)
  if (store._boxIconCloudUnsupported) payload = withoutFolderIcon(payload)
  if (!Object.keys(payload).length) return
  try {
    await store.sb.update('boxes', 'id=eq.' + id, payload)
  } catch (e) {
    if (isMissingBoxesTableError(e)) {
      store._boxesCloudUnsupported = true
      await saveCloudFlags(store)
      return
    }
    if (!store._boxIconCloudUnsupported && isMissingBoxIconColumnError(e) && patch && 'icon' in patch) {
      store._boxIconCloudUnsupported = true
      await saveCloudFlags(store)
      await cloudUpdateBox(store, id, withoutFolderIcon(patch))
      return
    }
    throw e
  }
}

export async function cloudDeleteBox(store: CloudStoreHost, id: string) {
  if (store._boxesCloudUnsupported) return
  try {
    await store.sb.remove('boxes', 'id=eq.' + id)
  } catch (e) {
    if (isMissingBoxesTableError(e)) {
      store._boxesCloudUnsupported = true
      await saveCloudFlags(store)
      return
    }
    throw e
  }
}

export async function cloudLogReview(store: CloudStoreHost, entry: ReviewLogEntry) {
  if (store._reviewLogCloudUnsupported) return
  const uid = store.sb.userId()
  if (!uid) throw new Error('Нет активной сессии — войдите снова')
  try {
    await store.sb.upsert('review_log', Object.assign({ user_id: uid }, entry), { onConflict: 'id' })
  } catch (e) {
    if (isReviewLogMissing(e)) { store._reviewLogCloudUnsupported = true; await saveCloudFlags(store); return }
    throw e
  }
}

export async function cloudRemoveReview(store: CloudStoreHost, id: string) {
  if (store._reviewLogCloudUnsupported) return
  try {
    await store.sb.remove('review_log', 'id=eq.' + id)
  } catch (e) {
    if (isReviewLogMissing(e)) { store._reviewLogCloudUnsupported = true; await saveCloudFlags(store); return }
    throw e
  }
}

export async function cloudSaveSettings(store: CloudStoreHost, settings: unknown) {
  const uid = store.sb.userId()
  if (!uid) throw new Error('Нет активной сессии — войдите снова')
  const row = {
    user_id: uid,
    data: settings,
    updated_at: Date.now(),
  }
  const push = async () => {
    try {
      await store.sb.upsert('settings', row, { onConflict: 'user_id' })
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/row-level security|42501/i.test(msg)) throw e
    }
    try {
      await store.sb.update('settings', 'user_id=eq.' + uid, {
        data: settings,
        updated_at: row.updated_at,
      })
    } catch (e) {
      /* try insert below */
    }
    try {
      await store.sb.insert('settings', row)
    } catch (e2) {
      await store.sb.update('settings', 'user_id=eq.' + uid, {
        data: settings,
        updated_at: Date.now(),
      })
    }
  }
  try {
    await push()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/row-level security|42501|JWT|session|401|403/i.test(msg)) {
      try {
        await store.sb.refresh()
        await push()
        return
      } catch (e2) {
        throw e2 instanceof Error ? e2 : e
      }
    }
    throw e
  }
}

export async function deleteImage(store: CloudStoreHost, url: string) {
  const marker = '/object/public/card-images/'
  const i = url.indexOf(marker)
  if (i === -1) return
  try { await store.sb.deleteFile('card-images', url.slice(i + marker.length)) } catch (e) { /* ignore */ }
}

export async function removeCardImages(store: CloudStoreHost, card: Card) {
  for (const url of [card.front_img, card.back_img]) {
    if (url) await deleteImage(store, url)
  }
}

async function emitSync(store: CloudStoreHost) {
  if (!store._onSyncChange) return
  store._onSyncChange({
    pending: store.queue.db ? await store.queue.size() : 0,
    failed: store.queue.db ? await store.queue.deadLetterCount() : 0,
    offline: store._offline,
  })
}

export async function uploadImage(store: CloudStoreHost, file: Blob) {
  const blob = await resizeImage(file)
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = store.sb.userId() + '/' + uuid() + '.' + ext
  if (!navigator.onLine) {
    const dataUrl = await blobToDataURL(blob)
    await store.queue.enqueue({ op: 'uploadImage', payload: { path, blob, contentType: blob.type } })
    store._offline = true
    await emitSync(store)
    return dataUrl
  }
  try {
    return await store.sb.uploadFile('card-images', path, blob, blob.type)
  } catch (e) {
    if (isNetworkError(e)) {
      const dataUrl = await blobToDataURL(blob)
      await store.queue.enqueue({ op: 'uploadImage', payload: { path, blob, contentType: blob.type } })
      store._offline = true
      await emitSync(store)
      return dataUrl
    }
    throw e
  }
}

export async function executeSyncItem(
  store: CloudStoreHost,
  { op, payload }: { op: string; payload: SyncPayload }
) {
  switch (op) {
    case 'createFolder': await cloudInsertFolder(store, payload.row as Folder); break
    case 'updateFolder': await cloudPatchFolder(store, payload.id!, payload.patch as Partial<Folder>); break
    case 'deleteFolder':
      await store.sb.remove('cards', 'folder_id=eq.' + payload.id)
      await store.sb.remove('folders', 'id=eq.' + payload.id)
      break
    case 'createBox': await cloudInsertBox(store, payload.row as Box); break
    case 'updateBox': await cloudUpdateBox(store, payload.id!, payload.patch as Partial<Box>); break
    case 'deleteBox': await cloudDeleteBox(store, payload.id!); break
    case 'createCard': await store.sb.insert('cards', payload.row); break
    case 'updateCard': await store.sb.update('cards', 'id=eq.' + payload.id, payload.patch); break
    case 'deleteCard':
      if (payload.urls) for (const url of payload.urls) await deleteImage(store, url as string)
      await store.sb.remove('cards', 'id=eq.' + payload.id)
      break
    case 'saveSettings':
      await cloudSaveSettings(store, payload.settings)
      break
    case 'uploadImage':
      payload.url = await store.sb.uploadFile('card-images', payload.path as string, payload.blob as Blob, payload.contentType as string)
      if (payload.cardId && payload.side) {
        await store.sb.update('cards', 'id=eq.' + payload.cardId, stampUpdatedAt({ [payload.side as string]: payload.url }))
      }
      break
    case 'logReview': await cloudLogReview(store, payload as unknown as ReviewLogEntry); break
    case 'removeReview': await cloudRemoveReview(store, payload.id!); break
    default: throw new Error('Unknown sync op: ' + op)
  }
}
