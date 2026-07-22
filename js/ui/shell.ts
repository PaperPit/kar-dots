import { store, app } from "../core/state.js"
import { el, toast } from "./ui.js"
import { ICONS } from "./constants.js"
import { brandMark, svgNode } from "./helpers.js"
import { nav } from "./navigation.js"
import { syncRavenEggScreen, tryRavenEggClick } from "../lib/raven-easter-egg.js"
import { animateViewIn, staggerIn } from "../lib/motion-ui.js"
import { createThemeToggle } from "./theme-toggle.js"
interface TabItem {
  id: string
  label: string
  icon: string
  hash: string
  onclick?: () => void
  badge?: string | null
}

interface NavItem {
  id: string
  btn: HTMLElement
  badgeEl: HTMLElement | null
}

interface ShellEl {
  header: HTMLElement
  main: HTMLElement
  tabbar: HTMLElement
  prependSlot: HTMLElement
  viewSlot: HTMLElement
  desktopNav: NavItem[]
  tabNav: NavItem[]
}



async function openStudyModePicker() {
  const { studyModePicker } = await import("../screens/review/mode-picker.js")
  studyModePicker({})
}

let dueBadge = 0
let shellEl: ShellEl | null = null
/** Последний экран shell — чтобы бейдж «Повторение» скрывался во время сессии. */
let lastViewName: string | null = null

function reviewDueBadge(viewName: string | null = lastViewName): string | null {
  if ((viewName ?? lastViewName) === "review") return null
  return dueBadge > 0 ? String(dueBadge) : null
}

function tabConfig(viewName: string | null = lastViewName): TabItem[] {
  return [
    { id: "home", label: "Папки", icon: ICONS.home, hash: "#home" },
    {
      id: "review",
      label: "Повторение",
      icon: ICONS.cards,
      onclick: () => openStudyModePicker(),
      hash: "#review",
      badge: reviewDueBadge(viewName)
    },
    { id: "settings", label: "Настройки", icon: ICONS.gear, hash: "#settings" }
  ]
}

function syncBadgeEl(badgeEl: HTMLElement | null, show: string | null): void {
  if (!badgeEl) return
  badgeEl.hidden = !show
  if (show) badgeEl.textContent = show
}

function makeNavItems(tabs: TabItem[], viewName: string, kind: "desktop" | "tab"): NavItem[] {
  return tabs.map((t) => {
    const badgeEl =
      t.id === "review" ? el("span", { class: "badge", hidden: !t.badge }, t.badge || "") : null
    const kids =
      kind === "desktop"
        ? [t.label, badgeEl]
        : [svgNode(t.icon), el("span", null, t.label), badgeEl]
    const btn = el(
      "button",
      {
        class: (kind === "desktop" ? "nav-btn" : "tab-btn") + (viewName === t.id ? " active" : ""),
        onclick: () => (t.onclick ? t.onclick() : nav(t.hash))
      },
      kids
    )
    return { id: t.id, btn, badgeEl }
  })
}

function buildShell(viewName: string): ShellEl {
  const tabs = tabConfig(viewName)
  const desktopNav = makeNavItems(tabs, viewName, "desktop")
  const tabNav = makeNavItems(tabs, viewName, "tab")

  const header = el(
    "header",
    { class: "header" },
    el("div", { class: "header-in" }, [
      brandMark({
        onclick: () => {
          const hash = location.hash || "#home"
          const onHomeGrid =
            hash === "#home" ||
            hash === "" ||
            hash.startsWith("#folder/") ||
            hash.startsWith("#box/")
          if (onHomeGrid && tryRavenEggClick()) return
          nav("#home")
        }
      }),
      el("div", { class: "header-actions" }, [
        el(
          "nav",
          { class: "nav-desktop" },
          desktopNav.map((x) => x.btn)
        ),
        createThemeToggle()
      ])
    ])
  )

  const tabbar = el(
    "div",
    { class: "tabbar" },
    tabNav.map((x) => x.btn)
  )
  const prependSlot = el("div", { class: "main-prepend", hidden: true })
  const viewSlot = el("div", { class: "view-slot" })
  const main = el("main", { class: "main" }, [prependSlot, viewSlot])

  return { header, main, tabbar, prependSlot, viewSlot, desktopNav, tabNav }
}

function shellAlive() {
  return shellEl && app.contains(shellEl.main)
}

function syncShellChrome(viewName: string | null): void {
  if (!shellEl) return
  if (viewName != null) lastViewName = viewName
  const badge = reviewDueBadge(viewName)
  const applyActive = viewName != null
  for (const items of [shellEl.desktopNav, shellEl.tabNav]) {
    for (const { id, btn, badgeEl } of items) {
      if (applyActive) btn.classList.toggle("active", viewName === id)
      if (id === "review") syncBadgeEl(badgeEl, badge)
    }
  }
}

export function setDueBadge(n: number): void {
  dueBadge = n
  syncShellChrome(null)
}

export async function refreshDueBadge(): Promise<number> {
  if (!store) {
    dueBadge = 0
    syncShellChrome(null)
    return 0
  }
  const { todayStudyCount } = await import("../data/home-stats.js")
  const { newBudget, reviewsBudget } = await import("./study-budget.js")
  dueBadge = Math.min(
    todayStudyCount(await store.getHomeStats(), newBudget()),
    reviewsBudget()
  )
  syncShellChrome(null)
  return dueBadge
}

export function shell(viewName: string, content: Node | Node[], prependToMain?: Node | null, opts: { hideTabbar?: boolean } = {}): void {
  syncRavenEggScreen(viewName)
  app.classList.toggle("app--study-session", !!opts.hideTabbar)

  if (!shellAlive()) {
    app.replaceChildren()
    shellEl = buildShell(viewName)
    app.append(shellEl.header, shellEl.main, shellEl.tabbar)
  } else {
    syncShellChrome(viewName)
  }

  if (!shellEl) return

  if (prependToMain) {
    shellEl.prependSlot.hidden = false
    shellEl.prependSlot.replaceChildren(prependToMain)
  } else {
    shellEl.prependSlot.hidden = true
    shellEl.prependSlot.replaceChildren()
  }

  const view = el("div", { class: "view" }, content)
  shellEl.viewSlot.replaceChildren(view)
  shellEl.main.scrollTop = 0

  requestAnimationFrame(() => {
    animateViewIn(view)
    staggerIn(view)
  })
}

export { nav } from "./navigation.js"

export function offlineBanner(): HTMLElement | null {
  if (!store || store.kind !== "cloud") return null
  const statusEl = el(
    "span",
    null,
    store.offline ? "Нет сети — изменения сохранятся локально." : "Проверяю синхронизацию…"
  )
  const actionsEl = el("div", { class: "sync-banner-actions" })
  const banner = el("div", { class: "offline-banner sync-banner", role: "status" }, [
    statusEl,
    actionsEl
  ])

  async function refresh() {
    if (!store || store.kind !== "cloud") return
    const pending = typeof store.pendingSync === "function" ? await store.pendingSync() : 0
    const failed = typeof store.deadLetterCount === "function" ? await store.deadLetterCount() : 0
    const hasWork = store.offline || pending > 0 || failed > 0

    banner.hidden = !hasWork
    actionsEl.replaceChildren()
    banner.classList.toggle("sync-banner-failed", failed > 0)
    if (!hasWork) return

    const parts = []
    if (store.offline) parts.push("Нет сети — новые изменения ждут подключения.")
    if (pending > 0) parts.push(`В очереди синхронизации: ${pending}.`)
    if (failed > 0) parts.push(`Не удалось отправить: ${failed}.`)
    statusEl.textContent = parts.join(" ")

    if (pending > 0 && !store.offline) {
      actionsEl.append(
        el(
          "button",
          {
            class: "link-btn sync-banner-btn",
            onclick: async () => {
              const r = await store.flushSync()
              toast(
                r.fail
                  ? `Синхронизировано: ${r.ok}, ошибок: ${r.fail}`
                  : `Синхронизировано: ${r.ok}`
              )
              await refresh()
            }
          },
          "Повторить"
        )
      )
    }

    if (failed > 0 && typeof store.deadLetters === "function") {
      const [letter] = await store.deadLetters()
      if (letter) {
        actionsEl.append(
          el(
            "button",
            {
              class: "link-btn sync-banner-btn",
              title: letter.error || "Ошибка синхронизации",
              onclick: async () => {
                const ok = await store.retryDeadLetter(letter.id)
                toast(
                  ok ? "Повторная синхронизация запущена" : "Запись уже обработана",
                  ok ? "ok" : "error"
                )
                await refresh()
              }
            },
            "Повторить ошибку"
          )
        )
        actionsEl.append(
          el(
            "button",
            {
              class: "link-btn sync-banner-btn",
              title: letter.error || "Ошибка синхронизации",
              onclick: async () => {
                const ok = await store.discardDeadLetter(letter.id)
                toast(ok ? "Ошибка синхронизации скрыта" : "Запись уже обработана")
                await refresh()
              }
            },
            "Скрыть"
          )
        )
      }
    }
  }

  if (typeof store.onSyncChange === "function") store.onSyncChange(() => refresh())
  refresh().catch((e) => {
    console.error("Sync banner error:", e)
    statusEl.textContent = "Не удалось прочитать состояние синхронизации."
    banner.hidden = false
  })
  return banner
}
