/**
 * Bridge для Chrome-расширения «КАР-точки — YouTube».
 * При ?ext_connect=1 отдаёт session + Supabase config через window.postMessage
 * → content script расширения → chrome.storage.
 */

import { cfg, sb } from "../core/state.js"
import { el, toast } from "../ui/ui.js"

const PAGE_TYPE = "KAR_EXT_CONNECT"
const PAGE_ACK = "KAR_EXT_CONNECT_ACK"
const PAGE_STATUS = "KAR_EXT_CONNECT_STATUS"

let bannerEl: HTMLElement | null = null
let waitingAck = false
let ackTimer: ReturnType<typeof setTimeout> | null = null
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

function sendPayload() {
  if (!sb?.hasSession()) {
    showBanner("Войдите в облачный аккаунт, чтобы подключить расширение.", "info")
    return
  }
  const supabaseUrl = cfg.SUPABASE_URL
  const anonKey = cfg.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    showBanner("Облако не настроено на этом инстансе.", "error")
    return
  }

  waitingAck = true
  showBanner("Подключаю расширение Chrome…", "info")

  window.postMessage(
    {
      type: PAGE_TYPE,
      session: sb.getSession(),
      supabaseUrl,
      anonKey
    },
    "*"
  )

  if (ackTimer) clearTimeout(ackTimer)
  ackTimer = setTimeout(() => {
    if (!waitingAck) return
    waitingAck = false
    showBanner(
      "Расширение не ответило. Установите unpacked-расширение из папки extension/ и обновите страницу.",
      "error"
    )
  }, 4000)
}

function onMessage(event: MessageEvent) {
  if (event.source !== window) return
  const data = event.data
  if (!data || typeof data !== "object") return

  if (data.type === PAGE_STATUS && data.installed && wantsConnect() && sb?.hasSession()) {
    sendPayload()
    return
  }

  if (data.type === PAGE_ACK) {
    waitingAck = false
    if (ackTimer) clearTimeout(ackTimer)
    if (data.ok) {
      showBanner("Расширение подключено. Можно вернуться на YouTube.", "ok")
      toast("Расширение Chrome подключено", "ok")
      try {
        const u = new URL(location.href)
        u.searchParams.delete("ext_connect")
        history.replaceState(null, "", u.pathname + u.search + u.hash)
      } catch {
        /* ignore */
      }
    } else {
      showBanner(data.error || "Не удалось передать сессию в расширение", "error")
    }
  }
}

/** Вызвать после boot (когда sb/cfg уже готовы). */
export function initExtConnect() {
  if (!wantsConnect()) return
  if (!listenerAttached) {
    window.addEventListener("message", onMessage)
    listenerAttached = true
  }
  if (initialized) {
    if (sb?.hasSession()) sendPayload()
    return
  }
  initialized = true

  showBanner(
    sb?.hasSession()
      ? "Ожидаю расширение Chrome…"
      : "Войдите в аккаунт — затем расширение подключится автоматически.",
    "info"
  )

  if (sb?.hasSession()) {
    setTimeout(() => sendPayload(), 300)
  }
}

/** Повторная попытка после успешного логина на странице с ?ext_connect=1. */
export function tryExtConnectAfterLogin() {
  if (!wantsConnect()) return
  initExtConnect()
  sendPayload()
}
