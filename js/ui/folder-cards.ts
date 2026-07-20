import { el, plural } from "./ui.js"
import { Folder, Box } from "./types.js"
import { folderSwatch, boxSwatch } from "./icons.js"
import { nav } from "./navigation.js"
import { folderStudyDue, FolderHomeRow } from "../data/home-stats.js"

interface HomeStatsLike {
  byFolder?: Record<string, FolderHomeRow>
}

interface CountStore {
  countCards(folderId: string): Promise<number> | number
  countDue(folderId: string): Promise<number> | number
  countNew(folderId: string): Promise<number> | number
}

export function folderCardStatsFromHome(homeStats: HomeStatsLike | undefined, folder: Folder, budget: number) {
  const row = homeStats?.byFolder?.[folder.id]
  return {
    n: row?.n ?? 0,
    due: folderStudyDue(row, budget)
  }
}

export async function folderCardStats(store: CountStore, folder: Folder, budget: number, homeStats: HomeStatsLike | undefined) {
  if (homeStats) return folderCardStatsFromHome(homeStats, folder, budget)
  const [n, dueCount, newCount] = await Promise.all([
    store.countCards(folder.id),
    store.countDue(folder.id),
    store.countNew(folder.id)
  ])
  return { n, due: dueCount + Math.min(newCount, budget) }
}

export function folderCardEl(folder: Folder, stats: { n: number; due: number }, i: number) {
  const { n, due } = stats
  return el(
    "div",
    {
      class: "folder-card stagger-in",
      style: { "--stagger-delay": i * 40 + "ms" },
      onclick: () => nav("#folder/" + folder.id)
    },
    [
      folderSwatch(folder),
      el("h3", null, folder.name),
      el("div", { class: "meta" }, "папка · " + n + " " + plural(n, "карточка", "карточки", "карточек")),
      folder.pack_id ? el("div", { class: "pack-chip" }, "Лексический пак") : null,
      due > 0 ? el("div", { class: "due-chip" }, String(due)) : null
    ]
  )
}

export function boxCardEl(box: Box, stats: { folders: number; cards: number; due: number }, i: number) {
  const { folders, cards, due } = stats
  const metaParts = [
    "коробка",
    folders + " " + plural(folders, "папка", "папки", "папок"),
    cards + " " + plural(cards, "карточка", "карточки", "карточек")
  ]
  return el(
    "div",
    {
      class: "box-card stagger-in",
      style: { "--stagger-delay": i * 40 + "ms" },
      onclick: () => nav("#box/" + box.id)
    },
    [
      boxSwatch(box),
      el("h3", null, box.name),
      el("div", { class: "meta" }, metaParts.join(" · ")),
      due > 0 ? el("div", { class: "due-chip" }, String(due)) : null
    ]
  )
}
