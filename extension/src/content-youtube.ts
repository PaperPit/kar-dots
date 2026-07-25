/** Обновление текущего видео при SPA-навигации YouTube. */

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

function notifyVideo() {
  const url = currentVideoUrl()
  if (!url) return
  chrome.runtime.sendMessage({
    type: "SET_VIDEO",
    url,
    title: videoTitle()
  }).catch(() => {})
}

notifyVideo()

document.addEventListener("yt-navigate-finish", () => notifyVideo())
window.addEventListener("popstate", () => notifyVideo())

let lastHref = location.href
const mo = new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href
    notifyVideo()
  }
})
mo.observe(document.documentElement, { childList: true, subtree: true })
