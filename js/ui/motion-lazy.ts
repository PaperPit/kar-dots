/**
 * Ленивая обёртка над lib/motion-ui (и, значит, над vendor/motion.mjs ~34 КБ).
 *
 * Раньше библиотека анимаций входила в стартовый граф модулей и грузилась до
 * первого кадра. Здесь она подтягивается динамическим import()-ом в простое
 * либо при первой анимации, а пока не загружена — работает запасной путь:
 * то же конечное состояние, но мгновенно или средствами CSS.
 *
 * Инвариант: ни один вызов не «проглатывает» финальное состояние. Обещания
 * возвращаются всегда, элементы всегда доходят до нужного класса/стиля.
 *
 * Класс `motion-ui` на <html> глушит CSS-анимации (см. css/style.css) — поэтому
 * он ставится только тогда, когда JS-анимации действительно доступны: либо
 * после загрузки модуля, либо сразу при «уменьшить движение», где и CSS, и JS
 * анимации не нужны.
 */

type MotionUi = typeof import("../lib/motion-ui.js")

let mod: MotionUi | null = null
let loading: Promise<MotionUi | null> | null = null
let scheduled = false

/** Пользователь просил уменьшить движение — анимации не нужны вовсе. */
function reduced(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function loadMotion(): Promise<MotionUi | null> {
  if (mod) return Promise.resolve(mod)
  if (loading) return loading
  loading = import("../lib/motion-ui.js")
    .then((m) => {
      mod = m
      // Теперь JS-анимации есть — можно отключать CSS-запасные.
      m.initMotionUi()
      return m
    })
    .catch((e) => {
      // Сеть/кэш подвели — остаёмся на CSS-анимациях, интерфейс не ломается.
      console.warn("[kar] анимации не загрузились, работаем без них:", e)
      return null
    })
  return loading
}

/** Начать фоновую загрузку, ничего не дожидаясь. */
function warmUp(): void {
  if (mod || loading || reduced()) return
  void loadMotion()
}

export function initMotionUi(): void {
  if (typeof document === "undefined") return
  if (reduced()) {
    // Ни CSS, ни JS анимаций: класс глушит CSS, а модуль не нужен.
    document.documentElement.classList.add("motion-ui")
    return
  }
  if (scheduled) return
  scheduled = true
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
  }
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(() => { void loadMotion() }, { timeout: 2000 })
  } else {
    setTimeout(() => { void loadMotion() }, 0)
  }
}

export function animateViewIn(el: HTMLElement | null): void | Promise<void> {
  if (mod) return mod.animateViewIn(el)
  warmUp()
  // Запасной путь — CSS-анимация .view, она отработает сама.
  return undefined
}

export function animateFadeIn(el: HTMLElement | null): void | Promise<void> {
  if (mod) return mod.animateFadeIn(el)
  warmUp()
  return undefined
}

export function staggerIn(parent: HTMLElement | null, selector = ".stagger-in"): void {
  if (mod) {
    mod.staggerIn(parent, selector)
    return
  }
  warmUp()
}

export function animateModalIn(overlay: HTMLElement, box: HTMLElement): Promise<void> {
  if (mod) return mod.animateModalIn(overlay, box)
  warmUp()
  // Открыть модалку нужно сейчас: класс `open` даёт CSS-переход и, главное,
  // конечное состояние — ждать загрузки анимаций здесь нельзя.
  overlay.classList.add("open")
  return Promise.resolve()
}

export function animateModalOut(overlay: HTMLElement, box: HTMLElement): Promise<void> {
  if (mod) return mod.animateModalOut(overlay, box)
  warmUp()
  overlay.classList.remove("open")
  // Столько же, сколько длится CSS-переход закрытия, — потом вызывающий удалит узел.
  return new Promise((resolve) => setTimeout(resolve, 260))
}

export function animateToastIn(node: HTMLElement): void | Promise<void> {
  if (mod) return mod.animateToastIn(node)
  warmUp()
  requestAnimationFrame(() => node.classList.add("show"))
  return undefined
}

export function animateToastOut(node: HTMLElement): void | Promise<void> {
  if (mod) return mod.animateToastOut(node)
  warmUp()
  node.classList.remove("show")
  return new Promise((resolve) => setTimeout(resolve, 350))
}

export function animateBootSplashOut(splash: HTMLElement | null): Promise<void> {
  if (!splash) return Promise.resolve()
  if (mod) return mod.animateBootSplashOut(splash)
  warmUp()
  // Сплэш обязан исчезнуть, даже если анимации так и не приехали.
  splash.remove()
  return Promise.resolve()
}
