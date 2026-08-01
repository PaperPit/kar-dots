import { el } from "./ui.js"
import { Folder, Box } from "./types.js"
import { folderSwatch, boxSwatch } from "./icons.js"
import { nav } from "./navigation.js"
import { folderStudyDue, FolderHomeRow } from "../data/home-stats.js"
import { t, tp } from "../lib/i18n.js"

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

/**
 * Плитка — не <button> (внутри заголовок и чипы, вид задан CSS), поэтому роль
 * и клавиатуру даём вручную: Enter/Пробел работают как клик, Tab доводит фокус.
 */
function activateOnKey<T extends HTMLElement>(node: T, run: () => void): T {
  node.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return
    e.preventDefault()
    run()
  })
  return node
}

export function folderCardEl(folder: Folder, stats: { n: number; due: number }, i: number) {
  const { n, due } = stats
  const open = () => nav("#folder/" + folder.id)
  const kind = folder.pack_id ? t("home.card.pack") : t("home.card.folder")
  const cards = `${n} ${tp("common.card", n)}`
  const label = [
    folder.name,
    kind,
    cards,
    due > 0 ? t("home.card.due", { n: due }) : null
  ].filter(Boolean).join(", ")
  const node = el(
    "div",
    {
      class: "folder-card stagger-in",
      style: { "--stagger-delay": i * 40 + "ms" },
      role: "button",
      tabindex: "0",
      "aria-label": label,
      onclick: open
    },
    [
      folderSwatch(folder),
      el("h3", null, folder.name),
      el("div", { class: "meta" }, t("home.card.folderMeta", { n, cards: tp("common.card", n) })),
      folder.pack_id ? el("div", { class: "pack-chip" }, t("home.card.pack")) : null,
      due > 0 ? el("div", { class: "due-chip" }, String(due)) : null
    ]
  )
  return activateOnKey(node, open)
}

export function boxCardEl(box: Box, stats: { folders: number; cards: number; due: number }, i: number) {
  const { folders, cards, due } = stats
  const meta = t("home.card.boxMeta", {
    folders: `${folders} ${tp("common.folder", folders)}`,
    cards: `${cards} ${tp("common.card", cards)}`
  })
  const open = () => nav("#box/" + box.id)
  const label = [
    box.name,
    meta,
    due > 0 ? t("home.card.due", { n: due }) : null
  ]
    .filter(Boolean)
    .join(", ")
  const node = el(
    "div",
    {
      class: "box-card stagger-in",
      style: { "--stagger-delay": i * 40 + "ms" },
      role: "button",
      tabindex: "0",
      "aria-label": t("home.card.boxAria", { label }),
      onclick: open
    },
    [
      boxSwatch(box),
      el("h3", null, box.name),
      el("div", { class: "meta" }, meta),
      due > 0 ? el("div", { class: "due-chip" }, String(due)) : null
    ]
  )
  return activateOnKey(node, open)
}
