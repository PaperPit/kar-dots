/** FAB на YouTube + обновление URL при SPA-навигации. */

const BTN_ID = "kar-ext-yt-fab"

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

function ensureButton() {
  const url = currentVideoUrl()
  let btn = document.getElementById(BTN_ID) as HTMLButtonElement | null

  if (!url) {
    btn?.remove()
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
      const videoUrl = currentVideoUrl()
      if (!videoUrl) return
      chrome.runtime.sendMessage({
        type: "OPEN_SIDEPANEL",
        url: videoUrl,
        title: videoTitle()
      })
    })
    document.documentElement.appendChild(btn)
  }

  btn.hidden = false
}

function notifyVideo() {
  const url = currentVideoUrl()
  if (!url) return
  chrome.runtime.sendMessage({
    type: "SET_VIDEO",
    url,
    title: videoTitle()
  }).catch(() => {})
}

function sync() {
  ensureButton()
  notifyVideo()
}

sync()

document.addEventListener("yt-navigate-finish", () => sync())
window.addEventListener("popstate", () => sync())

let lastHref = location.href
const mo = new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href
    sync()
  }
})
mo.observe(document.documentElement, { childList: true, subtree: true })
