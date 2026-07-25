/** FAB + оверлей с UI панели прямо в странице YouTube (Shadow DOM, без iframe/вкладок). */

import { mountKarPanel } from "./sidepanel/sidepanel.js"

const BTN_ID = "kar-ext-yt-fab"
const OVERLAY_ID = "kar-ext-yt-overlay"

let panelMounted = false
let cssText: string | null = null

function isWatchPage(href = location.href): boolean {
  try {
    const u = new URL(href)
    if (u.pathname === "/watch" && u.searchParams.get("v")) return true
    if (u.pathname.startsWith("/shorts/")) return true
    return false
  } catch {
    return false
  }
}

function currentVideoUrl(): string | null {
  if (!isWatchPage()) return null
  const u = new URL(location.href)
  if (u.pathname.startsWith("/shorts/")) {
    const id = u.pathname.split("/")[2]
    return id ? `https://www.youtube.com/shorts/${id}` : null
  }
  const v = u.searchParams.get("v")
  return v ? `https://www.youtube.com/watch?v=${v}` : null
}

function videoTitle(): string {
  const el =
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
    document.querySelector("h1 yt-formatted-string") ||
    document.querySelector("h1.ytd-video-primary-info-renderer") ||
    document.querySelector("#title h1")
  return (el?.textContent || document.title || "").replace(/ - YouTube$/, "").trim()
}

async function loadPanelCss(): Promise<string> {
  if (cssText != null) return cssText
  const url = chrome.runtime.getURL("sidepanel/sidepanel.css")
  const res = await fetch(url)
  cssText = await res.text()
  return cssText
}

function ensureOverlay(): { root: HTMLElement; app: HTMLElement } {
  let host = document.getElementById(OVERLAY_ID)
  if (host?.shadowRoot) {
    const app = host.shadowRoot.querySelector(".kar-ext-app") as HTMLElement
    return { root: host, app }
  }

  host = document.createElement("div")
  host.id = OVERLAY_ID
  host.style.all = "initial"
  host.style.position = "fixed"
  host.style.inset = "0"
  host.style.zIndex = "2147483645"
  host.style.display = "none"
  host.setAttribute("aria-hidden", "true")

  const shadow = host.attachShadow({ mode: "open" })
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { position: fixed; inset: 0; font-family: "Segoe UI", system-ui, sans-serif; }
      .backdrop { position: absolute; inset: 0; background: rgba(20, 14, 10, 0.28); }
      .panel {
        position: absolute; top: 0; right: 0; bottom: 0;
        width: min(420px, 100vw);
        display: flex; flex-direction: column;
        background: #f4ebe0;
        box-shadow: -12px 0 40px rgba(20, 14, 10, 0.28);
      }
      .bar {
        flex: none; display: flex; align-items: center; justify-content: space-between;
        height: 44px; padding: 0 10px 0 14px;
        background: #fbf7ef; border-bottom: 1px solid rgba(28, 22, 17, 0.12);
      }
      .bar-title { font: 700 14px/1 "Segoe UI", system-ui, sans-serif; color: #1c1611; }
      .bar-close {
        width: 32px; height: 32px; border: none; border-radius: 8px;
        background: transparent; color: #1c1611; font-size: 22px; cursor: pointer;
      }
      .bar-close:hover { background: rgba(28, 22, 17, 0.06); }
      .body { flex: 1 1 auto; min-height: 0; overflow: auto; }
    </style>
    <div class="wrap">
      <div class="backdrop" data-kar-close="1"></div>
      <aside class="panel" role="dialog" aria-label="КАР-точки">
        <header class="bar">
          <span class="bar-title">КАР-точки</span>
          <button type="button" class="bar-close" data-kar-close="1" aria-label="Закрыть">×</button>
        </header>
        <div class="body"><div class="kar-ext-app app"></div></div>
      </aside>
    </div>
  `

  shadow.addEventListener("click", (e) => {
    const t = e.target as HTMLElement | null
    if (t?.closest?.("[data-kar-close]")) hideOverlay()
  })

  document.documentElement.appendChild(host)
  const app = shadow.querySelector(".kar-ext-app") as HTMLElement
  return { root: host, app }
}

async function ensurePanelMounted(app: HTMLElement) {
  if (panelMounted) {
    mountKarPanel(app)
    return
  }
  const css = await loadPanelCss()
  const style = document.createElement("style")
  style.textContent = css
  app.parentElement?.insertBefore(style, app)
  mountKarPanel(app)
  panelMounted = true
}

async function showOverlay() {
  const { root, app } = ensureOverlay()
  await ensurePanelMounted(app)
  root.style.display = "block"
  root.setAttribute("aria-hidden", "false")
}

function hideOverlay() {
  const root = document.getElementById(OVERLAY_ID)
  if (!root) return
  root.style.display = "none"
  root.setAttribute("aria-hidden", "true")
}

async function openPanel() {
  const videoUrl = currentVideoUrl()
  if (!videoUrl) return
  try {
    await chrome.runtime.sendMessage({
      type: "SET_VIDEO",
      url: videoUrl,
      title: videoTitle()
    })
  } catch {
    /* ignore */
  }
  await showOverlay()
}

function ensureButton() {
  const url = currentVideoUrl()
  let btn = document.getElementById(BTN_ID) as HTMLButtonElement | null

  if (!url) {
    btn?.remove()
    hideOverlay()
    return
  }

  if (!btn) {
    btn = document.createElement("button")
    btn.id = BTN_ID
    btn.type = "button"
    btn.title = "КАР-точки: создать карточки из этого видео"
    btn.setAttribute("aria-label", "Создать карточки КАР-точки")
    btn.innerHTML =
      '<span class="kar-ext-fab-mark" aria-hidden="true">К</span><span class="kar-ext-fab-label">Карточки</span>'
    btn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const root = document.getElementById(OVERLAY_ID)
      if (root && root.style.display !== "none") hideOverlay()
      else void openPanel()
    })
    document.documentElement.appendChild(btn)
  }

  btn.hidden = false
}

function notifyVideo() {
  const url = currentVideoUrl()
  if (!url) return
  chrome.runtime
    .sendMessage({
      type: "SET_VIDEO",
      url,
      title: videoTitle()
    })
    .catch(() => {})
}

function sync() {
  ensureButton()
  notifyVideo()
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "SHOW_OVERLAY") void openPanel()
  if (msg?.type === "HIDE_OVERLAY") hideOverlay()
})

sync()

document.addEventListener("yt-navigate-finish", () => sync())
window.addEventListener("popstate", () => sync())
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideOverlay()
})

let lastHref = location.href
const mo = new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href
    sync()
  }
})
mo.observe(document.documentElement, { childList: true, subtree: true })
