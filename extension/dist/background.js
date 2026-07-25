// src/lib/constants.ts
var APP_ORIGIN = "https://kar-tochki.pages.dev";
var CONNECT_URL = `${APP_ORIGIN}/?ext_connect=1`;
var STORAGE_KEYS = {
  auth: "kar_ext_auth",
  prefs: "kar_ext_prefs",
  video: "kar_ext_video"
};

// src/lib/storage.ts
async function setAuth(auth) {
  if (auth) await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth });
  else await chrome.storage.local.remove(STORAGE_KEYS.auth);
}
async function setVideo(video) {
  try {
    if (video) await chrome.storage.local.set({ [STORAGE_KEYS.video]: video });
    else await chrome.storage.local.remove(STORAGE_KEYS.video);
  } catch {
  }
}

// src/background.ts
var PANEL_URL = "sidepanel/index.html";
var PANEL_WIDTH = 420;
var PANEL_HEIGHT = 740;
var PANEL_WIN_KEY = "kar_ext_panel_window_id";
async function getSavedPanelWindowId() {
  const data = await chrome.storage.local.get(PANEL_WIN_KEY);
  const id = data[PANEL_WIN_KEY];
  return typeof id === "number" ? id : null;
}
async function savePanelWindowId(id) {
  if (id == null) await chrome.storage.local.remove(PANEL_WIN_KEY);
  else await chrome.storage.local.set({ [PANEL_WIN_KEY]: id });
}
async function openPanelWindow() {
  const existingId = await getSavedPanelWindowId();
  if (existingId != null) {
    try {
      await chrome.windows.update(existingId, { focused: true });
      return;
    } catch {
      await savePanelWindowId(null);
    }
  }
  let left;
  let top;
  try {
    const current = await chrome.windows.getLastFocused();
    if (current.left != null && current.width != null) {
      left = Math.max(0, current.left + current.width - PANEL_WIDTH - 28);
    }
    if (current.top != null) {
      top = Math.max(0, current.top + 72);
    }
  } catch {
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(PANEL_URL),
    type: "popup",
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    focused: true,
    ...left != null ? { left } : {},
    ...top != null ? { top } : {}
  });
  if (win.id != null) await savePanelWindowId(win.id);
}
chrome.windows.onRemoved.addListener((windowId) => {
  void (async () => {
    const saved = await getSavedPanelWindowId();
    if (saved === windowId) await savePanelWindowId(null);
  })();
});
chrome.action.onClicked.addListener(() => {
  void openPanelWindow();
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  void (async () => {
    try {
      if (msg.type === "OPEN_SIDEPANEL" || msg.type === "OPEN_PANEL") {
        const tabId = sender.tab?.id;
        if (msg.url) {
          await setVideo({
            url: msg.url,
            title: msg.title,
            tabId
          });
        }
        await openPanelWindow();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "SET_VIDEO") {
        await setVideo({
          url: msg.url,
          title: msg.title,
          tabId: msg.tabId ?? sender.tab?.id
        });
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "AUTH_CONNECT") {
        if (!msg.session?.access_token || !msg.supabaseUrl || !msg.anonKey) {
          sendResponse({ ok: false, error: "\u041D\u0435\u043F\u043E\u043B\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u0435\u0441\u0441\u0438\u0438" });
          return;
        }
        await setAuth({
          session: msg.session,
          supabaseUrl: msg.supabaseUrl,
          anonKey: msg.anonKey,
          connectedAt: Date.now()
        });
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "AUTH_DISCONNECT") {
        await setAuth(null);
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "GET_STATE") {
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: "unknown" });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true;
});
