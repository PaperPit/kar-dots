/**
 * Bridge на kar-tochki.pages.dev:
 * страница шлёт window.postMessage({ type: 'KAR_EXT_CONNECT', ... }),
 * content script пересылает в service worker.
 */

const PAGE_TYPE = "KAR_EXT_CONNECT"
const PAGE_ACK = "KAR_EXT_CONNECT_ACK"
const PAGE_STATUS = "KAR_EXT_CONNECT_STATUS"

const RELOADED_MSG = "Расширение было перезагружено — обнови страницу и попробуй снова"

/**
 * См. content-youtube.ts: после перезагрузки расширения старый content script
 * остаётся на странице, и chrome.runtime.* бросает «Extension context
 * invalidated». Здесь это било по пользователю особенно неприятно — кнопка
 * «Подключить расширение» на сайте молча ничего не делала.
 *
 * Имя с префиксом не случайно: у content scripts нет import/export, поэтому для
 * TypeScript это не модули, а глобальные скрипты с общей областью имён — простой
 * contextAlive конфликтовал с одноимённой функцией в content-youtube.ts.
 */
function bridgeContextAlive(): boolean {
  try {
    return !!chrome.runtime?.id
  } catch {
    return false
  }
}

// Отвечаем строго на origin самой страницы, а не в "*": в ack уезжает статус
// подключения аккаунта, и сторонним фреймам его видеть незачем.
function reply(ok: boolean, error: string | null): void {
  window.postMessage({ type: PAGE_ACK, ok, error }, location.origin)
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.type !== PAGE_TYPE) return

  if (!bridgeContextAlive()) {
    reply(false, RELOADED_MSG)
    return
  }

  try {
    chrome.runtime.sendMessage(
      {
        type: "AUTH_CONNECT",
        session: data.session,
        supabaseUrl: data.supabaseUrl,
        anonKey: data.anonKey
      },
      (response) => {
        const err = chrome.runtime.lastError
        reply(!err && !!response?.ok, err?.message || response?.error || null)
      }
    )
  } catch {
    reply(false, RELOADED_MSG)
  }
})

// Сигнал странице, что расширение установлено.
if (bridgeContextAlive()) {
  window.postMessage({ type: PAGE_STATUS, installed: true }, location.origin)
}
