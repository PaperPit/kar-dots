/** Сдерживаем прокрутку .main при клавиатуре в режиме повторения (без блокировки WebView). */
export function initStudyKeyboardLock() {
  if (typeof window === "undefined") return

  let savedMainScroll = 0

  function mainEl() {
    return document.querySelector(".app--study-session .main")
  }

  function isStudyField(el: EventTarget | null): boolean {
    const node = el instanceof Element ? el : null
    return (
      !!node?.closest?.(".app--study-session") &&
      !!node?.matches?.("input:not([disabled]), textarea:not([disabled])")
    )
  }

  function pinMainScroll() {
    const main = mainEl()
    if (main) main.scrollTop = savedMainScroll
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      const field = e.target instanceof Element ? e.target.closest("input:not([disabled]), textarea:not([disabled])") : null
      if (!isStudyField(field)) return
      savedMainScroll = mainEl()?.scrollTop ?? 0
    },
    { capture: true, passive: true }
  )

  document.addEventListener(
    "focusin",
    (e) => {
      if (!isStudyField(e.target)) return
      pinMainScroll()
    },
    true
  )

  const vv = window.visualViewport
  if (vv) {
    vv.addEventListener("scroll", () => {
      if (document.activeElement && isStudyField(document.activeElement)) pinMainScroll()
    })
  }
}

/** focus без автопрокрутки (Safari / iOS WebView). */
export function focusWithoutScroll(el: HTMLElement | null): void {
  if (!el?.focus) return
  try {
    el.focus({ preventScroll: true })
  } catch {
    el.focus()
  }
}
