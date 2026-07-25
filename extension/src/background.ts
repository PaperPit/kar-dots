import { setAuth, setVideo } from "./lib/storage.js"
import type { ExtMessage } from "./lib/constants.js"

const PANEL_URL = "sidepanel/index.html"
const PANEL_WIDTH = 420
const PANEL_HEIGHT = 740
const PANEL_WIN_KEY = "kar_ext_panel_window_id"

async function getSavedPanelWindowId(): Promise<number | null> {
  const data = await chrome.storage.local.get(PANEL_WIN_KEY)
  const id = data[PANEL_WIN_KEY]
  return typeof id === "number" ? id : null
}

async function savePanelWindowId(id: number | null): Promise<void> {
  if (id == null) await chrome.storage.local.remove(PANEL_WIN_KEY)
  else await chrome.storage.local.set({ [PANEL_WIN_KEY]: id })
}

/** Отдельное popup-окно поверх браузера — без сдвига страницы как у Side Panel. */
async function openPanelWindow(): Promise<void> {
  const existingId = await getSavedPanelWindowId()
  if (existingId != null) {
    try {
      await chrome.windows.update(existingId, { focused: true })
      return
    } catch {
      await savePanelWindowId(null)
    }
  }

  let left: number | undefined
  let top: number | undefined
  try {
    const current = await chrome.windows.getLastFocused()
    if (current.left != null && current.width != null) {
      left = Math.max(0, current.left + current.width - PANEL_WIDTH - 28)
    }
    if (current.top != null) {
      top = Math.max(0, current.top + 72)
    }
  } catch {
    /* default placement */
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(PANEL_URL),
    type: "popup",
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    focused: true,
    ...(left != null ? { left } : {}),
    ...(top != null ? { top } : {})
  })

  if (win.id != null) await savePanelWindowId(win.id)
}

chrome.windows.onRemoved.addListener((windowId) => {
  void (async () => {
    const saved = await getSavedPanelWindowId()
    if (saved === windowId) await savePanelWindowId(null)
  })()
})

chrome.action.onClicked.addListener(() => {
  void openPanelWindow()
})

chrome.runtime.onMessage.addListener((msg: ExtMessage, sender, sendResponse) => {
  void (async () => {
    try {
      if (msg.type === "OPEN_SIDEPANEL" || msg.type === "OPEN_PANEL") {
        const tabId = sender.tab?.id
        if (msg.url) {
          await setVideo({
            url: msg.url,
            title: msg.title,
            tabId
          })
        }
        await openPanelWindow()
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
