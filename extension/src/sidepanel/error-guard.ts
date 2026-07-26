/**
 * Сторож старта окна расширения.
 *
 * Импортируется в sidepanel.ts самым первым и сам ничего не импортирует —
 * благодаря порядку вычисления ES-модулей его тело выполняется раньше тел всех
 * остальных модулей бандла. Это важно: если падает тело какого-нибудь импорта
 * (а в бандле их ~700 строк до кода самой панели), то обработчики ошибок внутри
 * sidepanel.ts зарегистрироваться уже не успевают, скрипт умирает целиком и
 * снаружи это выглядит как «расширение открылось пустым» — без единой подсказки.
 *
 * Здесь же снимается статическая заглушка из index.html: раз этот код выполнился,
 * значит скрипт как минимум загрузился, и заглушка про «скрипт не загрузился»
 * стала бы враньём.
 */

const FALLBACK_ID = "kar-boot-fallback"

function removeFallback(): void {
  document.getElementById(FALLBACK_ID)?.remove()
}

function paint(msg: string): void {
  const host = document.getElementById("app") || document.body
  if (!host) return
  const box = document.createElement("div")
  box.style.cssText =
    "margin:16px 14px;padding:14px;border:1px solid rgba(196,69,60,.35);" +
    "border-radius:12px;background:#fff;color:#1c1611;font:14px/1.45 system-ui,sans-serif"
  const h = document.createElement("p")
  h.style.cssText = "margin:0 0 8px;font-weight:600;color:#c4453c"
  h.textContent = "Расширение не смогло запуститься"
  const p = document.createElement("p")
  p.style.cssText = "margin:0 0 8px;white-space:pre-wrap;word-break:break-word"
  p.textContent = msg
  const hint = document.createElement("p")
  hint.style.cssText = "margin:0;color:#7a6d5f;font-size:13px"
  hint.textContent = "Скопируй этот текст — по нему видно, что именно упало на старте."
  box.append(h, p, hint)
  host.replaceChildren(box)
}

function describe(e: unknown): string {
  if (e instanceof Error) return (e.stack || e.name + ": " + e.message).slice(0, 1500)
  return String(e).slice(0, 1500)
}

window.addEventListener("error", (ev) => {
  paint(
    describe(ev.error || ev.message) +
      (ev.filename ? `\n\n${ev.filename}:${ev.lineno}:${ev.colno}` : "")
  )
})

window.addEventListener("unhandledrejection", (ev) => {
  paint(describe(ev.reason))
})

removeFallback()
