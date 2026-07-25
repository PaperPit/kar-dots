import type { MiniSupabase } from './supabase.js'
import type { SyncQueue } from './sync-queue.js'
import type { StoreCache } from './store-cache.js'
import type { Folder, Box, Settings } from './types.js'
import type { SrsMeta } from './srs-meta.js'
import type { Algo } from '../lib/srs.js'
import type { HomeStats } from './home-stats.js'

export interface SyncState {
  pending: number
  failed: number
  offline: boolean
}

export interface SyncPayload {
  row?: unknown
  id?: string
  patch?: unknown
  urls?: string[]
  settings?: unknown
  url?: string
  path?: string
  blob?: Blob
  contentType?: string
  cardId?: string
  side?: string
  [key: string]: unknown
}

/** Флаги совместимости со схемой Supabase (отсутствующие таблицы/колонки). */
export interface CloudCompatFlags {
  folderIcon: boolean
  reviewLog: boolean
  boxes: boolean
  boxId: boolean
  boxIcon: boolean
}

/** Минимальный хост для cloud-pull / cloud-remote / cloud-sync-runtime / cloud-queries. */
export interface CloudStoreHost {
  sb: MiniSupabase
  folders: Folder[]
  boxes: Box[]
  settings: Settings
  _cache: StoreCache
  _srsMeta: SrsMeta[] | null
  _offline: boolean
  queue: SyncQueue
  mirror: IDBDatabase
  _onSyncChange: ((state: SyncState) => void) | null
  _compat: CloudCompatFlags
  _homeStatsCache: HomeStats | null
  _homeStatsCacheAlgo: Algo | null
  _srsMetaPersistTimer: ReturnType<typeof setTimeout> | null
  _activityPushTimer: ReturnType<typeof setTimeout> | null
  _bgSyncTail: Promise<void>
  _cloudSyncPromise: Promise<void> | null

  _emitDataChange(): void
  _invalidateHomeStats?(): void
  saveSettings(s: Settings): Promise<unknown>
}
