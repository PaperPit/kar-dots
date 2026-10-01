/**
 * Bridge для Chrome-расширения «КАР-точки — YouTube».
 * Legacy Supabase session handoff removed — расширение работает без cloud auth
 * и сохраняет карточки как JSON для импорта в PWA.
 */

import { el } from "../ui/ui.js"

const PAGE_STATUS = "KAR_EXT_CONNECT_STATUS"

let bannerEl: HTMLElement | null = null
let listenerAttached = false
let initialized = false

function wantsConnect(): boolean {
  try {
    return new URLSearchParams(location.search).has("ext_connect")
  } catch {
    return false
  }
}

function removeBanner() {
  bannerEl?.remove()
  bannerEl = null
}

function showBanner(text: string, kind: "info" | "ok" | "error" = "info") {
  removeBanner()
  bannerEl = el(
    "div",
    {
      class: "ext-connect-banner ext-connect-" + kind,
      role: "status"
    },
    [
      el("span", null, text),
      el(
        "button",
        {
          type: "button",
          class: "btn ghost ext-connect-close",
          onclick: () => removeBanner()
        },
        "Закрыть"
      )
    ]
  )
  document.body.appendChild(bannerEl)
}

function onMessage(event: MessageEvent) {
  if (event.source !== window) return
  const data = event.data
  if (!data || typeof data !== "object") return
  if (data.type === PAGE_STATUS && data.installed && wantsConnect()) {
    showBanner(
      "Расширение установлено. Вход через Supabase больше не нужен — генерируйте карточки в панели и импортируйте JSON в приложении.",
      "ok"
    )
  }
}

/** Вызвать после boot. */
export function initExtConnect() {
  if (!wantsConnect()) return
  if (!listenerAttached) {
    window.addEventListener("message", onMessage)
    listenerAttached = true
  }
  if (initialized) return
  initialized = true
  showBanner(
    "Cloud-вход для расширения отключён. Используйте панель расширения → скачать JSON → Импорт в КАР-точках.",
    "info"
  )
}

/** @deprecated */
export function tryExtConnectAfterLogin() {
  initExtConnect()
}
