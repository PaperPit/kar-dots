// src/lib/constants.ts
var APP_ORIGIN = "https://kar-tochki.pages.dev";
var CONNECT_URL = `${APP_ORIGIN}/#settings`;
var STORAGE_KEYS = {
  prefs: "kar_ext_prefs",
  video: "kar_ext_video"
};

// src/lib/storage.ts
async function setVideo(video) {
  if (video) await chrome.storage.session.set({ [STORAGE_KEYS.video]: video });
  else await chrome.storage.session.remove(STORAGE_KEYS.video);
}

// src/background.ts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  void (async () => {
    try {
      if (msg.type === "SET_VIDEO") {
        await setVideo({
          url: msg.url,
          title: msg.title,
          tabId: msg.tabId ?? sender.tab?.id
        });
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "GET_STATE" || msg.type === "PING_CONNECT") {
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
//# sourceMappingURL=background.js.map
