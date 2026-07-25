import { setAuth, setVideo } from "./lib/storage.js"
import type { ExtMessage } from "./lib/constants.js"

async function showOverlayOnYouTubeTab(preferredTabId?: number): Promise<boolean> {
  if (preferredTabId != null) {
    try {
      await chrome.tabs.sendMessage(preferredTabId, { type: "SHOW_OVERLAY" })
      return true
    } catch {
      /* no content script */
    }
  }

  const tabs = await chrome.tabs.query({
    url: ["https://www.youtube.com/*", "https://youtube.com/*"]
  })
  const active = tabs.find((t) => t.active && t.id != null) || tabs.find((t) => t.id != null)
  if (active?.id == null) return false
  try {
    await chrome.tabs.sendMessage(active.id, { type: "SHOW_OVERLAY" })
    return true
  } catch {
    return false
  }
}

chrome.action.onClicked.addListener((tab) => {
  void showOverlayOnYouTubeTab(tab.id)
})

chrome.runtime.onMessage.addListener((msg: ExtMessage & { url?: string }, sender, sendResponse) => {
  void (async () => {
    try {
      if (msg.type === "OPEN_TAB" && msg.url) {
        await chrome.tabs.create({ url: msg.url })
        sendResponse({ ok: true })
        return
      }

      if (msg.type === "OPEN_SIDEPANEL" || msg.type === "OPEN_PANEL") {
        const tabId = sender.tab?.id
        if (msg.url) {
          await setVideo({
            url: msg.url,
            title: msg.title,
            tabId
          })
        }
        if (tabId != null) {
          await chrome.tabs.sendMessage(tabId, { type: "SHOW_OVERLAY" }).catch(() => {})
        } else {
          await showOverlayOnYouTubeTab()
        }
        sendResponse({ ok: true })
        return
      }

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
