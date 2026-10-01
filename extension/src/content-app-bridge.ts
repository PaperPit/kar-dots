/**
 * Bridge на сайте приложения: сигнал «расширение установлено».
 * Передача Supabase-сессии больше не используется.
 */

const PAGE_STATUS = "KAR_EXT_CONNECT_STATUS"

function bridgeContextAlive(): boolean {
  try {
    return !!chrome.runtime?.id
  } catch {
    return false
  }
}

if (bridgeContextAlive()) {
  window.postMessage({ type: PAGE_STATUS, installed: true }, location.origin)
}
