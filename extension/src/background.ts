import { setVideo } from "./lib/storage.js"
import type { ExtMessage } from "./lib/constants.js"

chrome.runtime.onMessage.addListener((msg: ExtMessage, sender, sendResponse) => {
  void (async () => {
    try {
      if (msg.type === "SET_VIDEO") {
        await setVideo({
          url: msg.url,
          title: msg.title,
          tabId: msg.tabId ?? sender.tab?.id
        })
        sendResponse({ ok: true })
        return
      }

      if (msg.type === "GET_STATE" || msg.type === "PING_CONNECT") {
        sendResponse({ ok: true })
        return
      }

      sendResponse({ ok: false, error: "unknown" })
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  })()
  return true
})
