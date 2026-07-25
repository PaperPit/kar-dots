/**
 * Bridge на kar-tochki.pages.dev:
 * страница шлёт window.postMessage({ type: 'KAR_EXT_CONNECT', ... }),
 * content script пересылает в service worker.
 */

const PAGE_TYPE = "KAR_EXT_CONNECT"
const PAGE_ACK = "KAR_EXT_CONNECT_ACK"
const PAGE_STATUS = "KAR_EXT_CONNECT_STATUS"

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.type !== PAGE_TYPE) return

  chrome.runtime.sendMessage(
    {
      type: "AUTH_CONNECT",
      session: data.session,
      supabaseUrl: data.supabaseUrl,
      anonKey: data.anonKey
    },
    (response) => {
      const err = chrome.runtime.lastError
      window.postMessage(
        {
          type: PAGE_ACK,
          ok: !err && !!response?.ok,
          error: err?.message || response?.error || null
        },
        "*"
      )
    }
  )
})

// Сигнал странице, что расширение установлено.
window.postMessage({ type: PAGE_STATUS, installed: true }, "*")
