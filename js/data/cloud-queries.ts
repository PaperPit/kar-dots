import { isNetworkError } from './supabase.js'
import { mirrorPutMany, indexGetAll } from './sync-queue.js'
import {
  countDueForFolder, countDueBetweenForFolder, countNewForFolder, buildReviewQueue, filterByFolder,
} from './srs-query.js'
import { REVIEW_CARD_FIELDS } from './srs-meta.js'
import { getCardsByIds, hydrateReviewQueue } from './card-hydrate.js'
import { shuffle } from '../lib/shuffle.js'
import { isYoutubeCard } from '../lib/youtube-import.js'
import type { Card } from './types.js'
import type { Algo } from '../lib/srs.js'
import type { CloudStoreHost } from './cloud-store-host.js'

/** Карточки папки: кэш → зеркало (если совпадает count) → сеть. */
export async function getFolderCards(store: CloudStoreHost, folderId: string) {
  if (store._cache.folderCache.has(folderId)) return store._cache.folderCache.get(folderId)!

  const mirrored = await indexGetAll<Card>(store.mirror, 'cards', 'folder_id', folderId)
  mirrored.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  const expected = store._cache.countCards(folderId)
  const mirrorLooksComplete = expected === 0
    ? mirrored.length === 0
    : mirrored.length > 0 && mirrored.length === expected

  if (mirrorLooksComplete && (!navigator.onLine || store._offline || store._srsMeta?.length)) {
    store._cache.folderCache.set(folderId, mirrored)
    return mirrored
  }

  if (navigator.onLine && !store._offline) {
    try {
      const cards = await store.sb.select<Card>(
        'cards',
        'folder_id=eq.' + folderId + '&order=created_at.desc',
      )
      await mirrorPutMany(store.mirror, 'cards', cards)
      cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      store._cache.folderCache.set(folderId, cards)
      return cards
    } catch (e) {
      if (!isNetworkError(e)) throw e
      store._offline = true
    }
  }

  store._cache.folderCache.set(folderId, mirrored)
  return mirrored
}

/**
 * Очередь повторения: slim `_srsMeta` + hydrate из зеркала.
 * Сеть — только если meta пуста (ещё не подтянулась).
 */
export async function getReviewCards(
  store: CloudStoreHost,
  folderId: string | null,
  algo: Algo,
  newLimit: number,
  now: number,
) {
  algo = algo || store.settings.algo
  now = now || Date.now()

  if (store._srsMeta?.length) {
    const source = filterByFolder(store._srsMeta, folderId)
    const { due, fresh } = buildReviewQueue(source, algo, newLimit, now)
    const ids = [...due.map(c => c.id), ...fresh.map(c => c.id)]
    const byId = await getCardsByIds(store.mirror, store._cache, ids)
    return {
      due: hydrateReviewQueue(due, byId),
      fresh: hydrateReviewQueue(fresh, byId),
    }
  }

  if (navigator.onLine && !store._offline) {
    try {
      const uid = store.sb.userId()
      const prefix = folderId ? 'folder_id=eq.' + folderId + '&user_id=eq.' + uid : 'user_id=eq.' + uid
      const sel = '&select=' + REVIEW_CARD_FIELDS
      const dueQ = algo === 'leitner'
        ? prefix + '&box=gt.0&box_due=lte.' + now + sel
        : algo === 'fsrs'
          ? prefix + '&fsrs_due=not.is.null&fsrs_due=lte.' + now + sel
          : prefix + '&sm2_due=not.is.null&sm2_due=lte.' + now + sel
      const newQ = algo === 'leitner'
        ? prefix + '&box=eq.0' + sel + '&limit=' + newLimit
        : algo === 'fsrs'
          ? prefix + '&fsrs_reps=is.null&fsrs_due=is.null' + sel + '&limit=' + newLimit
          : prefix + '&sm2_reps=eq.0&sm2_due=is.null' + sel + '&limit=' + newLimit
      const [dueCards, newCards] = await Promise.all([
        store.sb.select('cards', dueQ),
        store.sb.select('cards', newQ),
      ])
      await mirrorPutMany(store.mirror, 'cards', dueCards.concat(newCards))
      return { due: shuffle(dueCards), fresh: shuffle(newCards).slice(0, newLimit) }
    } catch (e) {
      if (!isNetworkError(e)) throw e
      store._offline = true
    }
  }

  const source = filterByFolder(store._srsMeta || [], folderId)
  const { due, fresh } = buildReviewQueue(source, algo, newLimit, now)
  const ids = [...due.map(c => c.id), ...fresh.map(c => c.id)]
  const byId = await getCardsByIds(store.mirror, store._cache, ids)
  return {
    due: hydrateReviewQueue(due, byId),
    fresh: hydrateReviewQueue(fresh, byId),
  }
}

export async function getCramCards(store: CloudStoreHost, folderId: string | null, limit: number) {
  const source = filterByFolder(store._srsMeta || [], folderId)
  const picked = shuffle(source)
  const slice = limit > 0 ? picked.slice(0, limit) : picked
  const byId = await getCardsByIds(store.mirror, store._cache, slice.map(c => c.id))
  return hydrateReviewQueue(slice, byId)
}

export async function scanFolderFronts(
  store: CloudStoreHost,
  folderId: string | null,
  { youtubeOnly = false }: { youtubeOnly?: boolean } = {},
) {
  const fromMirror = async () => {
    const cards = (await indexGetAll(store.mirror, 'cards', 'folder_id', folderId ?? '')) as Card[]
    const mini = []
    for (const c of cards) {
      if (youtubeOnly && !isYoutubeCard(c)) continue
      if (c.front) mini.push({ front: c.front })
    }
    return mini
  }

  const expected = store._cache.countCards(folderId ?? undefined)
  if (expected > 0 && store._srsMeta?.length) {
    const mirrored = await fromMirror()
    if (mirrored.length > 0) return mirrored
  }

  if (navigator.onLine && !store._offline) {
    try {
      const rows = (await store.sb.select(
        'cards',
        'folder_id=eq.' + folderId + '&select=front,description',
      )) as Card[]
      return rows
        .filter(c => !youtubeOnly || isYoutubeCard(c))
        .filter(c => c.front)
        .map(c => ({ front: c.front }))
    } catch (e) {
      if (!isNetworkError(e)) throw e
      store._offline = true
    }
  }
  return fromMirror()
}

export function countDue(store: CloudStoreHost, folderId: string | null, algo: Algo) {
  algo = algo || store.settings.algo
  return countDueForFolder(store._srsMeta ?? [], folderId, algo, Date.now())
}

export function countDueBetween(
  store: CloudStoreHost,
  folderId: string | null,
  algo: Algo,
  from: number,
  to: number,
) {
  algo = algo || store.settings.algo
  return countDueBetweenForFolder(store._srsMeta ?? [], folderId, algo, from, to)
}

export function countNew(store: CloudStoreHost, folderId: string | null, algo: Algo) {
  algo = algo || store.settings.algo
  return countNewForFolder(store._srsMeta ?? [], folderId, algo)
}
