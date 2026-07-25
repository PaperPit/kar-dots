import { getAll, mirrorPut, mirrorPutMany } from './sync-queue.js'
import { DEFAULT_SETTINGS } from './store-common.js'
import { normalizeFolderRecord, normalizeBoxRecord } from '../lib/folder-icons.js'
import { exportJSONPayload } from './store-contract.js'
import { invalidateDerivedCaches } from './cache-invalidate.js'
import { cloudOrQueue } from './cloud-sync-runtime.js'
import type { Card, Settings } from './types.js'
import type { CloudStoreHost } from './cloud-store-host.js'

export interface CloudImportHost extends CloudStoreHost {
  uploadImage(file: Blob): Promise<string>
  _patchSrsMeta(card: Card): void
  _flushSrsMetaPersist(): Promise<void>
  saveSettings(s: Settings): Promise<unknown>
}

export async function exportJSONFull(store: CloudImportHost) {
  const cards = await getAll(store.mirror, 'cards')
  return exportJSONPayload(store.folders, cards, store.settings, store.boxes)
}

export async function importJSON(store: CloudImportHost, text: string) {
  const data = JSON.parse(text)
  if (!data.folders || !data.cards) throw new Error('Неверный формат файла')
  for (const b of (data.boxes || [])) {
    if (store.boxes.find(x => x.id === b.id)) continue
    const row = normalizeBoxRecord(Object.assign({}, b, { user_id: store.sb.userId() }))
    if (row) {
      store.boxes.push(row)
      await mirrorPut(store.mirror, 'boxes', row)
      await cloudOrQueue(store, 'createBox', { row }, async () => row)
    }
  }
  for (const f of data.folders) {
    if (store.folders.find(x => x.id === f.id)) continue
    const row = normalizeFolderRecord(Object.assign({}, f, { user_id: store.sb.userId() }))
    if (row) {
      store.folders.push(row)
      await mirrorPut(store.mirror, 'folders', row)
      await cloudOrQueue(store, 'createFolder', { row }, async () => row)
    }
  }
  const importRows: Card[] = []
  for (const c of data.cards) {
    if (c.description == null) c.description = ''
    const row = Object.assign({}, c, { user_id: store.sb.userId() }) as Card
    for (const side of ['front_img', 'back_img'] as const) {
      const val = row[side]
      if (val && String(val).startsWith('data:')) {
        try {
          const blob = await (await fetch(String(val))).blob()
          const ext = blob.type === 'image/png' ? 'png' : 'jpg'
          row[side] = await store.uploadImage(new File([blob], 'img.' + ext, { type: blob.type }))
        } catch (e) { row[side] = undefined }
      }
    }
    importRows.push(row)
  }
  const BATCH = 100
  for (let i = 0; i < importRows.length; i += BATCH) {
    await mirrorPutMany(store.mirror, 'cards', importRows.slice(i, i + BATCH))
  }
  for (const row of importRows) {
    store._patchSrsMeta(row)
    await cloudOrQueue(store, 'createCard', { row }, async () => row)
  }
  if (data.settings) await store.saveSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings))
  store.folders.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
  store.boxes.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
  store._cache.clearFolderLists()
  store._cache.rebuildCountsFromSrsMeta(store.folders, store._srsMeta || [])
  await store._flushSrsMetaPersist()
  invalidateDerivedCaches(store, { allFolders: true })
}
