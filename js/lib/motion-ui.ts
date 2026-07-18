import { animate } from "../vendor/motion.mjs"

const EASE = [0.22, 0.9, 0.3, 1]
const DUR = 0.3

export function motionEnabled(): boolean {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function run(el: HTMLElement | null, keyframes: Record<string, unknown>, options: Record<string, unknown>): Promise<void> {
  if (!el) return Promise.resolve()
  return animate(el, keyframes, options).finished.catch(() => {})
}

export function initMotionUi(): void {
  document.documentElement.classList.add("motion-ui")
}

export function animateViewIn(el: HTMLElement | null): void | Promise<void> {
  if (!el || !motionEnabled()) return
  el.style.animation = "none"
  const touch = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches
  const keyframes = touch ? { opacity: [0, 1] } : { opacity: [0, 1], y: [10, 0] }
  return run(el, keyframes, { duration: DUR, ease: EASE }).then(() => {
    el.style.transform = ""
  })
}

export function animateFadeIn(el: HTMLElement | null): void | Promise<void> {
  if (!el || !motionEnabled()) return
  el.style.animation = "none"
  return run(el, { opacity: [0, 1], y: [8, 0] }, { duration: DUR, ease: EASE })
}

export function staggerIn(parent: HTMLElement | null, selector = ".stagger-in"): void {
  const kids = parent ? Array.from(parent.querySelectorAll<HTMLElement>(selector)) : []
  if (!kids.length || !motionEnabled()) return
  kids.forEach((el) => {
    el.style.animation = "none"
    el.style.opacity = "0"
  })
  kids.forEach((el, i) => {
    run(el, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, delay: i * 0.04, ease: EASE })
  })
}

export function animateModalIn(overlay: HTMLElement, box: HTMLElement): Promise<void> {
  if (!motionEnabled()) {
    overlay.classList.add("open")
    return Promise.resolve()
  }
  overlay.style.opacity = "0"
  box.style.transform = "translateY(18px) scale(0.97)"
  overlay.classList.add("open")
  return Promise.all([
    run(overlay, { opacity: [0, 1] }, { duration: 0.26, ease: EASE }),
    run(box, { y: [18, 0], scale: [0.97, 1] }, { duration: 0.26, ease: EASE })
  ]).then(() => {})
}

export function animateModalOut(overlay: HTMLElement, box: HTMLElement): Promise<void> {
  if (!motionEnabled()) {
    overlay.classList.remove("open")
    return new Promise((resolve) => setTimeout(resolve, 260))
  }
  return Promise.all([
    run(overlay, { opacity: [1, 0] }, { duration: 0.22, ease: EASE }),
    run(box, { y: [0, 12], scale: [1, 0.97] }, { duration: 0.22, ease: EASE })
  ]).then(() => {})
}

export function animateToastIn(t: HTMLElement): void | Promise<void> {
  if (!motionEnabled()) {
    requestAnimationFrame(() => t.classList.add("show"))
    return
  }
  t.style.transition = "none"
  t.style.opacity = "0"
  t.style.transform = "translateY(14px) scale(0.96)"
  t.classList.add("show")
  run(t, { opacity: [0, 1], y: [14, 0], scale: [0.96, 1] }, { duration: 0.3, ease: EASE })
}

export function animateToastOut(t: HTMLElement): void | Promise<void> {
  if (!motionEnabled()) {
    t.classList.remove("show")
    return new Promise((resolve) => setTimeout(resolve, 350))
  }
  return run(t, { opacity: [1, 0], y: [0, 8], scale: [1, 0.96] }, { duration: 0.28, ease: EASE })
}

export function animateBootSplashOut(splash: HTMLElement | null): Promise<void> {
  if (!splash) return Promise.resolve()
  if (!motionEnabled()) {
    splash.remove()
    return Promise.resolve()
  }
  return run(splash, { opacity: [1, 0], scale: [1, 0.96] }, { duration: 0.35, ease: EASE }).then(
    () => splash.remove()
  )
}
