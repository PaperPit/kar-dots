import { store, app } from "../core/state.js"
import { el, toast } from "./ui.js"
import { ICONS } from "./constants.js"
import { brandMark, svgNode } from "./helpers.js"
import { nav } from "./navigation.js"
import { syncRavenEggScreen, tryRavenEggClick } from "../lib/raven-easter-egg.js"
import { animateViewIn, staggerIn } from "./motion-lazy.js"
import { createThemeToggle } from "./theme-toggle.js"
import { t } from "../lib/i18n.js"
interface TabItem {
  id: string
  label: string
  /** Короче подпись для мобильного tabbar (опционально). */
  tabLabel?: string
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

/** Активный пункт меню: редактор заметки подсвечивает «Заметки». */
function navActiveId(viewName: string | null): string | null {
  if (viewName === "note") return "notes"
  return viewName
}

function tabConfig(viewName: string | null = lastViewName): TabItem[] {
  return [
    {
      id: "home",
      label: t("shell.nav.home"),
      tabLabel: t("shell.nav.homeTab"),
      icon: ICONS.home,
      hash: "#home"
    },
    {
      id: "notes",
      label: t("shell.nav.notes"),
      tabLabel: t("shell.nav.notesTab"),
      icon: ICONS.note,
      hash: "#notes"
    },
    {
      id: "review",
      label: t("shell.nav.review"),
      tabLabel: t("shell.nav.reviewTab"),
      icon: ICONS.cards,
      onclick: () => openStudyModePicker(),
      hash: "#review",
      badge: reviewDueBadge(viewName)
    },
    {
      id: "stats",
      label: t("shell.nav.stats"),
      tabLabel: t("shell.nav.statsTab"),
      icon: ICONS.chart,
      hash: "#stats"
    },
    {
      id: "settings",
      label: t("shell.nav.settings"),
      tabLabel: t("shell.nav.settingsTab"),
      icon: ICONS.gear,
      hash: "#settings"
    }
  ]
}

function syncBadgeEl(badgeEl: HTMLElement | null, show: string | null): void {
  if (!badgeEl) return
  badgeEl.hidden = !show
  if (show) badgeEl.textContent = show
}

function makeNavItems(tabs: TabItem[], viewName: string, kind: "desktop" | "tab"): NavItem[] {
  const active = navActiveId(viewName)
  return tabs.map((t) => {
    const badgeEl =
      t.id === "review" ? el("span", { class: "badge", hidden: !t.badge }, t.badge || "") : null
    const label = kind === "tab" && t.tabLabel ? t.tabLabel : t.label
    const kids =
      kind === "desktop"
        ? [t.label, badgeEl]
        : [svgNode(t.icon), el("span", null, label), badgeEl]
    const btn = el(
      "button",
      {
        class: (kind === "desktop" ? "nav-btn" : "tab-btn") + (active === t.id ? " active" : ""),
        "aria-label": t.label,
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
        /* Тема — как можно правее, ростом с сегменты навигации. */
        createThemeToggle()
      ])
    ])
  )

  const tabbar = el(
    "nav",
    { class: "tabbar", "aria-label": t("shell.nav.aria") },
    tabNav.map((x) => x.btn)
  )
  const prependSlot = el("div", { class: "main-prepend", hidden: true })
  const viewSlot = el("div", { class: "view-slot" })
  const main = el("main", { class: "main", id: "mainContent" }, [prependSlot, viewSlot])

  return { header, main, tabbar, prependSlot, viewSlot, desktopNav, tabNav }
}

function shellAlive() {
  return shellEl && app.contains(shellEl.main)
}

function syncShellChrome(viewName: string | null): void {
  if (!shellEl) return
  if (viewName != null) lastViewName = viewName
  const badge = reviewDueBadge(viewName)
  const active = navActiveId(viewName)
  const applyActive = active != null
  for (const items of [shellEl.desktopNav, shellEl.tabNav]) {
    for (const { id, btn, badgeEl } of items) {
      if (applyActive) btn.classList.toggle("active", active === id)
      if (id === "review") syncBadgeEl(badgeEl, badge)
    }
  }
}

export function setDueBadge(n: number): void {
  dueBadge = n
  syncShellChrome(null)
}

/** Drop cached shell so next `shell()` rebuilds chrome (e.g. after locale change). */
export function invalidateShell(): void {
  shellEl = null
  lastViewName = null
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
    const skip = el(
      "a",
      { class: "skip-link", href: "#mainContent" },
      t("shell.skipToContent")
    )
    app.append(skip, shellEl.header, shellEl.main, shellEl.tabbar)
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

/** Сеть недоступна: либо стор уже это понял, либо браузер сообщил сам. */
function isOffline(): boolean {
  if (store && store.offline) return true
  return typeof navigator !== "undefined" && navigator.onLine === false
}

/** Живые баннеры синхронизации — по одному на отрисованный экран. */
const liveSyncBanners = new Set<{ node: HTMLElement; refresh: () => Promise<void> }>()
let netListenersBound = false

function refreshLiveSyncBanners() {
  for (const entry of liveSyncBanners) {
    // Экран сменился — баннер больше не в документе, забываем его.
    if (!entry.node.isConnected) {
      liveSyncBanners.delete(entry)
      continue
    }
    entry.refresh().catch((e) => console.error("Sync banner error:", e))
  }
}

/**
 * Слушаем оба события сети один раз на всё приложение.
 * Раньше подписка была только на 'online' (в data/store-cloud), поэтому уход
 * в офлайн баннер замечал лишь при следующей перерисовке экрана.
 */
function bindNetworkListeners() {
  if (netListenersBound || typeof window === "undefined") return
  netListenersBound = true
  window.addEventListener("online", refreshLiveSyncBanners)
  window.addEventListener("offline", refreshLiveSyncBanners)
}

export function offlineBanner(): HTMLElement | null {
  if (!store || store.kind !== "cloud") return null

  const wrap = el("div", { class: "status-banners" })
  const schemaMsg =
    typeof store.schemaWarning === "string" && store.schemaWarning
      ? store.schemaWarning
      : null
  if (schemaMsg) {
    wrap.append(
      el("div", { class: "offline-banner schema-banner", role: "alert" }, schemaMsg)
    )
  }

  const statusEl = el(
    "span",
    null,
    isOffline() ? t("shell.offline.cloud") : t("shell.sync.checking")
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
    const offline = isOffline()
    const hasWork = offline || pending > 0 || failed > 0

    banner.hidden = !hasWork
    actionsEl.replaceChildren()
    banner.classList.toggle("sync-banner-failed", failed > 0)
    if (!hasWork) return

    const parts = []
    if (offline) parts.push(t("shell.sync.waiting"))
    if (pending > 0) parts.push(t("shell.sync.pending", { n: pending }))
    if (failed > 0) parts.push(t("shell.sync.failed", { n: failed }))
    statusEl.textContent = parts.join(" ")

    if (pending > 0 && !offline) {
      actionsEl.append(
        el(
          "button",
          {
            class: "link-btn sync-banner-btn",
            onclick: async () => {
              const r = await store.flushSync()
              toast(
                r.fail
                  ? t("shell.sync.doneFail", { ok: r.ok, fail: r.fail })
                  : t("shell.sync.doneOk", { ok: r.ok })
              )
              await refresh()
            }
          },
          t("shell.sync.retry")
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
              title: letter.error || t("shell.sync.errorTitle"),
              onclick: async () => {
                const ok = await store.retryDeadLetter(letter.id)
                toast(
                  ok ? t("shell.sync.retryStarted") : t("shell.sync.alreadyHandled"),
                  ok ? "ok" : "error"
                )
                await refresh()
              }
            },
            t("shell.sync.retryError")
          )
        )
        actionsEl.append(
          el(
            "button",
            {
              class: "link-btn sync-banner-btn",
              title: letter.error || t("shell.sync.errorTitle"),
              onclick: async () => {
                const ok = await store.discardDeadLetter(letter.id)
                toast(ok ? t("shell.sync.discarded") : t("shell.sync.alreadyHandled"))
                await refresh()
              }
            },
            t("shell.sync.hide")
          )
        )
      }
    }
  }

  if (typeof store.onSyncChange === "function") store.onSyncChange(() => refresh())
  bindNetworkListeners()
  // Чистим отвалившиеся баннеры прошлых экранов, чтобы набор не рос.
  for (const entry of liveSyncBanners) {
    if (!entry.node.isConnected) liveSyncBanners.delete(entry)
  }
  liveSyncBanners.add({ node: banner, refresh })
  refresh().catch((e) => {
    console.error("Sync banner error:", e)
    statusEl.textContent = t("shell.sync.readFailed")
    banner.hidden = false
  })
  wrap.append(banner)
  return wrap
}
