import * as SRS from "../lib/srs.js"
import { srsMatch } from "./srs-query.js"
import type { SrsRow, Algo } from "../lib/srs.js"

export interface FolderHomeRow {
  n: number
  due: number
  newRaw: number
}

export interface HomeStats {
  totalCards: number
  dueAll: number
  newAllRaw: number
  dueTomorrowAll: number
  byFolder: Record<string, FolderHomeRow>
}

export function emptyHomeStats(): HomeStats {
  return { totalCards: 0, dueAll: 0, newAllRaw: 0, dueTomorrowAll: 0, byFolder: {} }
}

/** Один проход → stats для home / settings / badges. */
export function buildHomeStats(cards: SrsRow[], algo: Algo, now = Date.now()): HomeStats {
  const byFolder: Record<string, FolderHomeRow> = {}
  let totalCards = 0
  let dueAll = 0
  let newAllRaw = 0
  let dueTomorrowAll = 0

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const { start: tStart, end: tEnd } = SRS.dayBounds(tomorrow)

  for (const card of cards) {
    const fid = card?.folder_id
    if (!fid) continue
    totalCards++
    let row = byFolder[fid]
    if (!row) {
      row = { n: 0, due: 0, newRaw: 0 }
      byFolder[fid] = row
    }
    row.n++
    if (srsMatch.due(card, algo, now)) {
      row.due++
      dueAll++
    } else if (srsMatch.isNew(card, algo)) {
      row.newRaw++
      newAllRaw++
    }
    if (srsMatch.dueBetween(card, algo, tStart, tEnd)) {
      dueTomorrowAll++
    }
  }

  return { totalCards, dueAll, newAllRaw, dueTomorrowAll, byFolder }
}

/** Сколько карточек в сегодняшней сессии: due + новые в пределах дневного бюджета. */
export function todayStudyCount(stats: HomeStats | null, budget: number | string): number {
  if (!stats) return 0
  const b = Math.max(0, Number(budget) || 0)
  return (stats.dueAll || 0) + Math.min(stats.newAllRaw || 0, b)
}

/** Для одной папки: due + до `budget` новых. */
export function folderStudyDue(row: FolderHomeRow | null | undefined, budget: number | string): number {
  if (!row) return 0
  const b = Math.max(0, Number(budget) || 0)
  return row.due + Math.min(row.newRaw, b)
}

/**
 * Для коробки: сумма due по папкам + один общий бюджет новых
 * (не min(new, budget) на каждую папку — иначе бюджет умножается).
 */
export function boxStudyDue(homeStats: HomeStats | null, folderIds: string[] | undefined, budget: number | string): number {
  if (!homeStats || !folderIds?.length) return 0
  const b = Math.max(0, Number(budget) || 0)
  let due = 0
  let newRaw = 0
  for (const id of folderIds) {
    const row = homeStats.byFolder?.[id]
    if (!row) continue
    due += row.due
    newRaw += row.newRaw
  }
  return due + Math.min(newRaw, b)
}
