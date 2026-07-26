// src/content-youtube.ts
function isWatchPage(href = location.href) {
  try {
    const u = new URL(href);
    if (u.pathname === "/watch" && u.searchParams.get("v")) return true;
    if (u.pathname.startsWith("/shorts/")) return true;
    return false;
  } catch {
    return false;
  }
}
function currentVideoUrl() {
  if (!isWatchPage()) return null;
  const u = new URL(location.href);
  if (u.pathname.startsWith("/shorts/")) {
    const id = u.pathname.split("/")[2];
    return id ? `https://www.youtube.com/shorts/${id}` : null;
  }
  const v = u.searchParams.get("v");
  return v ? `https://www.youtube.com/watch?v=${v}` : null;
}
function videoTitle() {
  const el = document.querySelector("h1.ytd-watch-metadata yt-formatted-string") || document.querySelector("h1 yt-formatted-string") || document.querySelector("h1.ytd-video-primary-info-renderer") || document.querySelector("#title h1");
  return (el?.textContent || document.title || "").replace(/ - YouTube$/, "").trim();
}
document.getElementById("kar-ext-yt-fab")?.remove();
var alive = true;
var observer = null;
function shutdown() {
  if (!alive) return;
  alive = false;
  observer?.disconnect();
  observer = null;
  document.removeEventListener("yt-navigate-finish", onNavigate);
  window.removeEventListener("popstate", onNavigate);
}
function contextAlive() {
  if (!alive) return false;
  try {
    if (chrome.runtime?.id) return true;
  } catch {
  }
  shutdown();
  return false;
}
function notifyVideo() {
  if (!contextAlive()) return;
  const url = currentVideoUrl();
  if (!url) return;
  try {
    void chrome.runtime.sendMessage({ type: "SET_VIDEO", url, title: videoTitle() }).catch(() => {
    });
  } catch {
    shutdown();
  }
}
function onNavigate() {
  notifyVideo();
}
notifyVideo();
document.addEventListener("yt-navigate-finish", onNavigate);
window.addEventListener("popstate", onNavigate);
var lastHref = location.href;
observer = new MutationObserver(() => {
  if (location.href === lastHref) return;
  lastHref = location.href;
  notifyVideo();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
//# sourceMappingURL=content-youtube.js.map
