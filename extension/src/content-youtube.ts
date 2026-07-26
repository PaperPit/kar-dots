/**
 * Content script на YouTube: сообщает сервис-воркеру, какое видео открыто.
 * Кнопку на странице не рисуем — панель открывается иконкой расширения.
 */

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

// Осколок прошлых версий: пока кнопка существовала, она вставлялась в
// documentElement и переживала перезагрузку расширения. Убираем при старте,
// иначе на уже открытой вкладке остаётся мёртвая кнопка без обработчика.
document.getElementById("kar-ext-yt-fab")?.remove()

/**
 * При перезагрузке или обновлении расширения на chrome://extensions его контекст
 * умирает, а этот скрипт остаётся жить на уже открытой странице. Любое обращение
 * к chrome.runtime.* после этого бросает «Extension context invalidated», и без
 * защиты ошибка сыпалась на каждом переходе по YouTube. Ловим один раз и глушим
 * скрипт: свежую копию Chrome внедрит сам при следующей загрузке страницы.
 */
let alive = true
let observer: MutationObserver | null = null

function shutdown(): void {
  if (!alive) return
  alive = false
  observer?.disconnect()
  observer = null
  document.removeEventListener("yt-navigate-finish", onNavigate)
  window.removeEventListener("popstate", onNavigate)
}

function contextAlive(): boolean {
  if (!alive) return false
  try {
    // Само чтение chrome.runtime.id бросает, когда контекст уже отобран.
    if (chrome.runtime?.id) return true
  } catch {
    /* контекст мёртв */
  }
  shutdown()
  return false
}

function notifyVideo(): void {
  if (!contextAlive()) return
  const url = currentVideoUrl()
  if (!url) return
  try {
    void chrome.runtime
      .sendMessage({ type: "SET_VIDEO", url, title: videoTitle() })
      // Сервис-воркер мог ещё не проснуться — это не ошибка: следующий переход
      // по видео отправит сообщение заново.
      .catch(() => {})
  } catch {
    // sendMessage бросает синхронно, если контекст умер между проверкой и вызовом.
    shutdown()
  }
}

function onNavigate(): void {
  notifyVideo()
}

notifyVideo()

document.addEventListener("yt-navigate-finish", onNavigate)
window.addEventListener("popstate", onNavigate)

// YouTube — SPA, и событие yt-navigate-finish приходит не во всех сборках,
// поэтому дополнительно следим за сменой URL. Наблюдатель нужен только ради
// этого, так что тело обработчика держим предельно дешёвым: на YouTube мутации
// идут сплошным потоком.
let lastHref = location.href
observer = new MutationObserver(() => {
  if (location.href === lastHref) return
  lastHref = location.href
  notifyVideo()
})
observer.observe(document.documentElement, { childList: true, subtree: true })
