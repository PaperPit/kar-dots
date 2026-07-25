import { setAuth, setVideo } from "./lib/storage.js"
import type { ExtMessage } from "./lib/constants.js"

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

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

      if (msg.type === "AUTH_CONNECT") {
        if (!msg.session?.access_token || !msg.supabaseUrl || !msg.anonKey) {
          sendResponse({ ok: false, error: "Неполные данные сессии" })
          return
        }
        await setAuth({
          session: msg.session,
          supabaseUrl: msg.supabaseUrl,
          anonKey: msg.anonKey,
          connectedAt: Date.now()
        })
        sendResponse({ ok: true })
        return
      }

      if (msg.type === "AUTH_DISCONNECT") {
        await setAuth(null)
        sendResponse({ ok: true })
        return
      }

      if (msg.type === "GET_STATE") {
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
