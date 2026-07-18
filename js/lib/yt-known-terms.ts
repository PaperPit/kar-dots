// Кэш известных терминов для YouTube-импорта (паки + YouTube-карточки в папках).

import { fetchPackManifest, isVocabPackFolder } from "./vocab-packs.js"
import { collectKnownTerms, isYoutubeCard } from "./youtube-import.js"
import type { Card, Folder } from "../data/types.js"
import {
  PACKS_KEY,
  getKnownTermsSlice,
  putKnownTermsSlice,
  folderSliceKey,
  clearKnownTermsFolderSlices,
  clearKnownTermsCardSlices
} from "./yt-known-terms-idb.js"

interface MiniCard {
  front: string
}

interface SessionCache {
  key: string
  terms: Set<string>
}

interface ImportStore {
  folders: Folder[]
  countCards(folderId: string): Promise<number>
  getFolderCards(folderId: string): Promise<Card[]>
  scanFolderFronts?(folderId: string, opts: { youtubeOnly: boolean }): Promise<MiniCard[]>
}

let generation = 0
let sessionCache: SessionCache | null = null
const packCardsCache = new Map<string, MiniCard[]>()

/** folderId — точечный сброс IDB; без аргумента / null — все папки. */
export function bumpKnownTermsCache(folderId: string | null): void {
  generation++
  sessionCache = null
  if (folderId) clearKnownTermsFolderSlices(folderId)
  else clearKnownTermsCardSlices()
}

async function loadPackCards(file: string): Promise<MiniCard[]> {
  if (packCardsCache.has(file)) return packCardsCache.get(file)!
  const res = await fetch("packs/" + file)
  if (!res.ok) throw new Error("pack unavailable")
  const data: { cards?: MiniCard[] } = await res.json()
  const cards = data.cards || []
  packCardsCache.set(file, cards)
  return cards
}

async function loadPackSources(): Promise<MiniCard[][]> {
  const cached = await getKnownTermsSlice(PACKS_KEY)
  if (cached?.mini) return cached.mini as MiniCard[][]

  const sources: MiniCard[][] = []
  try {
    const manifest = await fetchPackManifest()
    for (const meta of manifest.packs || []) {
      try {
        sources.push(await loadPackCards(meta.file))
      } catch {
        /* pack unavailable */
      }
    }
  } catch {
    /* manifest unavailable */
  }

  if (sources.length) {
    await putKnownTermsSlice(PACKS_KEY, { mini: sources })
  }
  return sources
}

async function folderMiniCards(store: ImportStore, folderId: string, youtubeOnly: boolean): Promise<MiniCard[]> {
  const key = folderSliceKey(folderId, youtubeOnly)
  const n = await store.countCards(folderId)
  const cached = await getKnownTermsSlice(key)
  if (cached && cached.n === n) return cached.mini as MiniCard[]

  let mini: MiniCard[]
  if (typeof store.scanFolderFronts === "function") {
    mini = await store.scanFolderFronts(folderId, { youtubeOnly })
  } else {
    const cards = await store.getFolderCards(folderId)
    mini = (youtubeOnly ? cards.filter(isYoutubeCard) : cards)
      .filter((c: Card) => c.front)
      .map((c: Card) => ({ front: c.front }))
  }

  await putKnownTermsSlice(key, { n, mini })
  return mini
}

export async function loadKnownTermsForImport(store: ImportStore, folderId: string): Promise<Set<string>> {
  const key = `${generation}:${folderId}`
  if (sessionCache?.key === key) return sessionCache.terms

  const sources = await loadPackSources()

  for (const f of store.folders) {
    if (isVocabPackFolder(f)) continue
    try {
      sources.push(await folderMiniCards(store, f.id, f.id !== folderId))
    } catch {
      /* folder unread */
    }
  }

  const terms = collectKnownTerms(sources)
  sessionCache = { key, terms }
  return terms
}
