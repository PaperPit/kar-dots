"use strict";
(() => {
  // src/content-youtube.ts
  var BTN_ID = "kar-ext-yt-fab";
  var OVERLAY_ID = "kar-ext-yt-overlay";
  var FRAME_ID = "kar-ext-yt-frame";
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
  function ensureOverlay() {
    let root = document.getElementById(OVERLAY_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = OVERLAY_ID;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
    <div class="kar-ext-overlay-backdrop" data-kar-close="1"></div>
    <aside class="kar-ext-overlay-panel" role="dialog" aria-label="\u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438">
      <header class="kar-ext-overlay-bar">
        <span class="kar-ext-overlay-title">\u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438</span>
        <button type="button" class="kar-ext-overlay-close" data-kar-close="1" aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C">\xD7</button>
      </header>
      <iframe id="${FRAME_ID}" class="kar-ext-overlay-frame" title="\u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438"></iframe>
    </aside>
  `;
    root.addEventListener("click", (e) => {
      const t = e.target;
      if (t?.closest?.("[data-kar-close]")) hideOverlay();
    });
    document.documentElement.appendChild(root);
    return root;
  }
  function showOverlay() {
    const root = ensureOverlay();
    const frame = document.getElementById(FRAME_ID);
    const panelUrl = chrome.runtime.getURL("sidepanel/index.html");
    if (frame) {
      if (frame.src !== panelUrl) frame.src = panelUrl;
      else frame.src = panelUrl + "?t=" + Date.now();
    }
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("kar-ext-overlay-open");
  }
  function hideOverlay() {
    const root = document.getElementById(OVERLAY_ID);
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("kar-ext-overlay-open");
  }
  async function openPanel() {
    const videoUrl = currentVideoUrl();
    if (!videoUrl) return;
    try {
      await chrome.runtime.sendMessage({
        type: "SET_VIDEO",
        url: videoUrl,
        title: videoTitle()
      });
    } catch {
    }
    showOverlay();
  }
  function ensureButton() {
    const url = currentVideoUrl();
    let btn = document.getElementById(BTN_ID);
    if (!url) {
      btn?.remove();
      hideOverlay();
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
        const root = document.getElementById(OVERLAY_ID);
        if (root?.classList.contains("is-open")) hideOverlay();
        else void openPanel();
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
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "SHOW_OVERLAY") {
      void openPanel();
    }
    if (msg?.type === "HIDE_OVERLAY") {
      hideOverlay();
    }
  });
  sync();
  document.addEventListener("yt-navigate-finish", () => sync());
  window.addEventListener("popstate", () => sync());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideOverlay();
  });
  var lastHref = location.href;
  var mo = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      sync();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
