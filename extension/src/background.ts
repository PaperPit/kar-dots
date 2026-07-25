import { setAuth, setVideo } from "./lib/storage.js"
import type { ExtMessage } from "./lib/constants.js"

async function injectYouTubeContent(tabId: number): Promise<void> {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content-youtube.css"]
  }).catch(() => {})
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["dist/content-youtube.js"]
  })
}

async function showOverlayOnYouTubeTab(preferredTabId?: number): Promise<boolean> {
  const trySend = async (tabId: number) => {
    await chrome.tabs.sendMessage(tabId, { type: "SHOW_OVERLAY" })
  }

  const tryTab = async (tabId: number) => {
    try {
      await trySend(tabId)
      return true
    } catch {
      // После Reload расширения старый content script «мёртв» — внедряем заново.
      try {
        await injectYouTubeContent(tabId)
        await trySend(tabId)
        return true
      } catch {
        return false
      }
    }
  }

  if (preferredTabId != null) {
    if (await tryTab(preferredTabId)) return true
  }

  const tabs = await chrome.tabs.query({
    url: ["https://www.youtube.com/*", "https://youtube.com/*"]
  })
  const active = tabs.find((t) => t.active && t.id != null) || tabs.find((t) => t.id != null)
  if (active?.id == null) return false
  return tryTab(active.id)
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
          await showOverlayOnYouTubeTab(tabId)
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
