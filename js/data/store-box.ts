/** Коробки — группы папок (без карточек). */

import { boxStudyDue } from "./home-stats.js"
import type { Folder } from "./types.js"
import type { HomeStats } from "./home-stats.js"

export function foldersInBox(folders: Folder[], boxId: string | null): Folder[] {
  return folders.filter((f) => f.box_id === boxId)
}

export function looseFolders(folders: Folder[]): Folder[] {
  return folders.filter((f) => !f.box_id)
}

export function boxFolderStatsFromHome(homeStats: HomeStats | null, folders: Folder[], boxId: string | null, budget: number | string): { folders: number; cards: number; due: number } {
  const inBox = foldersInBox(folders, boxId)
  let cards = 0
  for (const f of inBox) {
    cards += homeStats?.byFolder?.[f.id]?.n ?? 0
  }
  const due = boxStudyDue(
    homeStats,
    inBox.map((f) => f.id),
    budget
  )
  return { folders: inBox.length, cards, due }
}

export async function boxFolderStats(store: { folders: Folder[]; countCards(folderId: string): Promise<number>; countDue(folderId: string, algo?: unknown): Promise<number>; countNew(folderId: string, algo?: unknown): Promise<number> }, boxId: string | null, budget: number | string, homeStats?: HomeStats | null) {
  if (homeStats) return boxFolderStatsFromHome(homeStats, store.folders, boxId, budget)
  const folders = foldersInBox(store.folders, boxId)
  let cards = 0
  let dueSum = 0
  let newSum = 0
  for (const f of folders) {
    const [n, dueCount, newCount] = await Promise.all([
      store.countCards(f.id),
      store.countDue(f.id),
      store.countNew(f.id)
    ])
    cards += n
    dueSum += dueCount
    newSum += newCount
  }
  return {
    folders: folders.length,
    cards,
    due: dueSum + Math.min(newSum, Math.max(0, Number(budget) || 0))
  }
}

export function clearBoxFromFolders(folders: Folder[], boxId: string | null): void {
  for (const f of folders) {
    if (f.box_id === boxId) f.box_id = null
  }
}
