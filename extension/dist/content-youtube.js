"use strict";
(() => {
  // src/content-youtube.ts
  var BTN_ID = "kar-ext-yt-fab";
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
  function ensureButton() {
    const url = currentVideoUrl();
    let btn = document.getElementById(BTN_ID);
    if (!url) {
      btn?.remove();
      return;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.type = "button";
      btn.title = "\u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438: \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438\u0437 \u044D\u0442\u043E\u0433\u043E \u0432\u0438\u0434\u0435\u043E";
      btn.setAttribute("aria-label", "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438");
      btn.innerHTML = '<span class="kar-ext-fab-mark" aria-hidden="true">\u041A</span><span class="kar-ext-fab-label">\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438</span>';
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const videoUrl = currentVideoUrl();
        if (!videoUrl) return;
        chrome.runtime.sendMessage({
          type: "OPEN_PANEL",
          url: videoUrl,
          title: videoTitle()
        });
      });
      document.documentElement.appendChild(btn);
    }
    btn.hidden = false;
  }
  function notifyVideo() {
    const url = currentVideoUrl();
    if (!url) return;
    chrome.runtime.sendMessage({
      type: "SET_VIDEO",
      url,
      title: videoTitle()
    }).catch(() => {
    });
  }
  function sync() {
    ensureButton();
    notifyVideo();
  }
  sync();
  document.addEventListener("yt-navigate-finish", () => sync());
  window.addEventListener("popstate", () => sync());
  var lastHref = location.href;
  var mo = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      sync();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
