/**
 * Единая сетка безопасности для необработанных ошибок.
 *
 * Раньше упавший промис или исключение вне try/catch не оставляли следа:
 * экран замирал, а пользователь не понимал, что произошло. Здесь мы пишем
 * подробности в консоль (для разбора) и показываем один ненавязчивый тост.
 * Никакой телеметрии — наружу ничего не уходит.
 */
import { toastAction } from "./ui.js"
import { t } from "../lib/i18n.js"
import { reloadOnceForStaleChunk } from "../lib/stale-chunk.js"

/** Не чаще одного тоста в этот интервал — иначе шторм ошибок завалит экран. */
const THROTTLE_MS = 8000
const TOAST_MS = 6000

let bound = false
let lastShownAt = 0

function report(reason: unknown, where: string): void {
  console.error("[" + where + "]", reason)
  // Устаревший hashed-чанк после деплоя — тихий reload вместо тоста.
  if (reloadOnceForStaleChunk(reason)) return

  const now = Date.now()
  if (now - lastShownAt < THROTTLE_MS) return
  // Ошибка до готовности разметки — тосту некуда встать, хватит консоли.
  if (typeof document === "undefined" || !document.getElementById("toasts")) return
  lastShownAt = now

  toastAction(
    t("app.error.unexpected"),
    t("app.error.reload"),
    () => location.reload(),
    TOAST_MS
  )
}

/** Идемпотентно: повторный вызов ничего не подписывает заново. */
export function initGlobalErrors(): void {
  if (bound || typeof window === "undefined") return
  bound = true

  window.addEventListener("error", (e: ErrorEvent) => {
    // Сбой загрузки картинки или скрипта прилетает с target-элементом —
    // это не падение приложения, тост тут только мешал бы.
    if (e.target && e.target !== window) return
    report(e.error ?? e.message, "error")
  })

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    report(e.reason, "unhandledrejection")
  })
}
