import * as SRS from "../lib/srs.js"
import { shuffle } from "../lib/shuffle.js"
import type { SrsRow, Algo } from "../lib/srs.js"

/** Shared SRS predicates for cursor scans (LocalStore) and in-memory lists (CloudStore). */
export const srsMatch = {
  due: (c: SrsRow, algo: Algo, now: number) => SRS.isDue(c, algo, now),
  dueBetween: (c: SrsRow, algo: Algo, from: number, to: number) => SRS.isDueBetween(c, algo, from, to),
  isNew: (c: SrsRow, algo: Algo) => SRS.isNew(c, algo)
}

export function filterByFolder(cards: SrsRow[], folderId?: string | null): SrsRow[] {
  if (!folderId) return cards
  return cards.filter((c) => c.folder_id === folderId)
}

function countWhere(cards: SrsRow[], pred: (c: SrsRow) => boolean): number {
  let n = 0
  for (const c of cards) if (pred(c)) n++
  return n
}

export function countDueInList(cards: SrsRow[], algo: Algo, now: number): number {
  return countWhere(cards, (c) => srsMatch.due(c, algo, now))
}

export function countDueBetweenInList(cards: SrsRow[], algo: Algo, from: number, to: number): number {
  return countWhere(cards, (c) => srsMatch.dueBetween(c, algo, from, to))
}

export function countNewInList(cards: SrsRow[], algo: Algo): number {
  return countWhere(cards, (c) => srsMatch.isNew(c, algo))
}

export function countDueForFolder(cards: SrsRow[], folderId: string | null, algo: Algo, now: number): number {
  return countDueInList(filterByFolder(cards, folderId), algo, now)
}

export function countDueBetweenForFolder(cards: SrsRow[], folderId: string | null, algo: Algo, from: number, to: number): number {
  return countDueBetweenInList(filterByFolder(cards, folderId), algo, from, to)
}

export function countNewForFolder(cards: SrsRow[], folderId: string | null, algo: Algo): number {
  return countNewInList(filterByFolder(cards, folderId), algo)
}

export interface ReviewQueue {
  due: SrsRow[]
  fresh: SrsRow[]
}

export function buildReviewQueue(cards: SrsRow[], algo: Algo, newLimit: number, now: number): ReviewQueue {
  const due: SrsRow[] = []
  const fresh: SrsRow[] = []
  for (const c of cards) {
    if (srsMatch.due(c, algo, now)) due.push(c)
    else if (srsMatch.isNew(c, algo)) fresh.push(c)
  }
  return { due: shuffle(due), fresh: shuffle(fresh).slice(0, newLimit) }
}
