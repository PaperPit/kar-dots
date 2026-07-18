import { haptic } from "./helpers.js"

const CARD_EXIT_MS = 640
export { CARD_EXIT_MS }
const THRESH = 52
const LOCK_THRESH = 10
const AXIS_RATIO = 1.15
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

function maxDrag() {
  return Math.min(window.innerWidth * 0.42, 220)
}

interface SwipeOpts {
  cardEl?: HTMLElement | null
  onSwipe: (dir: "left" | "right") => void
  enabled: () => boolean
}

function withResistance(dx: number) {
  const cap = maxDrag()
  const abs = Math.abs(dx)
  if (abs <= cap) return dx
  const sign = Math.sign(dx)
  return sign * (cap + (abs - cap) * 0.22)
}

function dragTransform(tx: number) {
  const tilt = Math.max(-10, Math.min(10, tx * 0.045))
  return `translateX(${tx}px) rotate(${tilt}deg)`
}

function clearDrag(el: HTMLElement, box: HTMLElement | null) {
  if (!el) return
  el.classList.remove(
    "swipe-dragging",
    "swipe-animating",
    "swipe-exiting",
    "swipe-exiting-left",
    "swipe-exiting-right"
  )
  el.style.transform = ""
  el.style.opacity = ""
  el.style.transition = ""
  if (box) {
    box.dataset.swipeDir = ""
    box.dataset.grading = ""
    box.classList.remove("is-exit-left", "is-exit-right", "is-grading", "is-card-exiting")
    box.style.removeProperty("--swipe-glow")
  }
}

function setDragHint(box: HTMLElement | null, dx: number) {
  if (!box) return
  const abs = Math.abs(dx)
  const intensity = Math.min(abs / maxDrag(), 1)
  if (abs >= 12) {
    box.style.setProperty("--swipe-glow", String(0.3 + intensity * 0.7))
    if (dx < 0) box.dataset.swipeDir = "left"
    else box.dataset.swipeDir = "right"
  } else {
    box.dataset.swipeDir = ""
    box.style.removeProperty("--swipe-glow")
  }
}

function markExitVisuals(box: HTMLElement | null, dir: "left" | "right") {
  if (!box) return
  box.dataset.swipeDir = dir === "right" ? "right" : "left"
  box.dataset.grading = "1"
  box.classList.add("is-grading", "is-card-exiting")
  box.classList.remove("is-exit-left", "is-exit-right")
  box.classList.add(dir === "right" ? "is-exit-right" : "is-exit-left")
  box.style.setProperty("--swipe-glow", "1")
}

/** Плавный уход карточки влево/вправо (кнопки и свайпы). */
export function animateCardExit(el: HTMLElement | null, dir: "left" | "right", onDone: () => void, box: HTMLElement | null) {
  if (!el) {
    onDone()
    return
  }
  if (reduceMotion()) {
    clearDrag(el, box)
    onDone()
    return
  }
  if (el.classList.contains("swipe-exiting")) {
    onDone()
    return
  }

  el.getAnimations?.().forEach((a) => a.cancel())
  el.classList.remove(
    "swipe-dragging",
    "swipe-animating",
    "swipe-exiting-left",
    "swipe-exiting-right"
  )

  markExitVisuals(box, dir)
  haptic(8)

  const fromTx = readCurrentTx(el)
  const hasDrag = Math.abs(fromTx) > 4

  let done = false
  const finish = (e: Event | null, type: "animation" | "transition") => {
    if (done) return
    if (e) {
      if (e.target !== el) return
      if (type === "transition" && (e as TransitionEvent).propertyName !== "transform") return
    }
    done = true
    el.removeEventListener("animationend", onAnimEnd)
    el.removeEventListener("transitionend", onTransEnd)
    onDone()
  }
  const onAnimEnd = (e: AnimationEvent) => finish(e, "animation")
  const onTransEnd = (e: TransitionEvent) => finish(e, "transition")

  if (hasDrag) {
    // Свайп: продолжаем с текущей позиции пальца, короче если уже сдвинута
    el.classList.add("swipe-exiting")
    const travel = window.innerWidth * 0.55 + 48
    const progress = Math.min(1, Math.abs(fromTx) / travel)
    const ms = Math.round(Math.max(260, (1 - progress * 0.5) * CARD_EXIT_MS))
    const off = (dir === "right" ? 1 : -1) * travel
    const tilt = dir === "right" ? 8 : -8
    el.style.transition = `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.round(ms * 0.75)}ms ease`
    void el.offsetWidth
    requestAnimationFrame(() => {
      el.style.transform = `translateX(${off}px) rotate(${tilt}deg)`
      el.style.opacity = "0"
    })
    el.addEventListener("transitionend", onTransEnd)
    setTimeout(() => finish(null, "transition"), ms + 80)
    return
  }

  // Кнопки: CSS keyframes из центра
  el.style.transform = ""
  el.style.opacity = ""
  el.style.transition = "none"
  void el.offsetWidth
  el.classList.add("swipe-exiting", dir === "right" ? "swipe-exiting-right" : "swipe-exiting-left")
  el.addEventListener("animationend", onAnimEnd)
  setTimeout(() => finish(null, "animation"), CARD_EXIT_MS + 120)
}

function readCurrentTx(el: HTMLElement) {
  const m = el.style.transform?.match(/translateX\(([-\d.]+)px\)/)
  return m ? Number(m[1]) : 0
}

function springBack(el: HTMLElement, box: HTMLElement | null) {
  if (reduceMotion() || box?.dataset?.grading === "1" || el?.classList.contains("swipe-exiting")) {
    return
  }
  el.classList.remove("swipe-dragging")
  el.classList.add("swipe-animating")
  el.style.transition = "transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease"
  requestAnimationFrame(() => {
    el.style.transform = dragTransform(0)
    el.style.opacity = "1"
  })
  const onEnd = (e: TransitionEvent) => {
    if (e.target !== el || e.propertyName !== "transform") return
    el.removeEventListener("transitionend", onEnd)
    clearDrag(el, box)
  }
  el.addEventListener("transitionend", onEnd)
  setTimeout(() => clearDrag(el, box), 450)
}

function isGradeControl(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false
  return !!node.closest(".grade-row, .grade-btn, .swipe-hint, .keyboard-hint")
}

/**
 * Горизонтальные свайпы для оценки на touch (после переворота).
 * ← не знаю, → знаю
 */
export function attachSwipeGrades(box: HTMLElement, opts: SwipeOpts) {
  const layer = () => opts.cardEl || box.querySelector(".flip-swipe-wrap")

  let startX = 0
  let startY = 0
  let tracking = false
  let axis: "horizontal" | "vertical" | null = null
  let touchFromGrade = false

  function setDrag(dx: number, el: HTMLElement) {
    const tx = withResistance(dx)
    el.style.transform = dragTransform(tx)
    const fade = Math.min(Math.abs(tx) / (maxDrag() * 1.6), 0.12)
    el.style.opacity = String(1 - fade)
    setDragHint(box, tx)
  }

  function markHandled() {
    box.dataset.swipeHandled = "1"
  }

  function commitSwipe(dir: "left" | "right") {
    const el = layer()
    if (!el) return
    markHandled()
    opts.onSwipe(dir)
  }

  box.addEventListener(
    "touchstart",
    (e) => {
      if (box.dataset.grading === "1") return
      if (!opts.enabled()) return
      if (isGradeControl(e.target)) {
        touchFromGrade = true
        return
      }
      touchFromGrade = false
      if (e.touches.length !== 1) return
      const el = layer()
      if (!el || el.classList.contains("swipe-exiting")) return
      startX = e.touches[0]!.clientX
      startY = e.touches[0]!.clientY
      tracking = true
      axis = null
      el.classList.remove("swipe-animating")
      el.style.transition = "none"
    },
    { passive: true }
  )

  box.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking || !opts.enabled() || box.dataset.grading === "1") return
      if (e.touches.length !== 1) return
      const el = layer()
      if (!el) return

      const dx = e.touches[0]!.clientX - startX
      const dy = e.touches[0]!.clientY - startY

      if (!axis) {
        const adx = Math.abs(dx)
        const ady = Math.abs(dy)
        if (adx < LOCK_THRESH && ady < LOCK_THRESH) return
        if (adx >= ady * AXIS_RATIO) axis = "horizontal"
        else if (ady >= adx * AXIS_RATIO) {
          axis = "vertical"
          tracking = false
          return
        } else return
      }

      if (axis !== "horizontal") return
      e.preventDefault()
      el.classList.add("swipe-dragging")
      setDrag(dx, el)
    },
    { passive: false }
  )

  function onTouchEnd(e: TouchEvent) {
    if (touchFromGrade) {
      touchFromGrade = false
      return
    }
    if (box.dataset.grading === "1") return
    if (!tracking || !opts.enabled()) return
    tracking = false
    const el = layer()
    if (!el) return

    if (axis !== "horizontal") {
      axis = null
      return
    }

    const dx = e.changedTouches[0]!.clientX - startX
    axis = null

    if (Math.abs(dx) > 8) markHandled()

    if (Math.abs(dx) >= THRESH) {
      commitSwipe(dx > 0 ? "right" : "left")
      return
    }
    springBack(el, box)
  }

  box.addEventListener("touchend", onTouchEnd, { passive: true })
  box.addEventListener(
    "touchcancel",
    () => {
      if (!tracking) return
      const wasHorizontal = axis === "horizontal"
      tracking = false
      axis = null
      const el = layer()
      if (!el) return
      if (wasHorizontal && box.dataset.grading !== "1") springBack(el, box)
      else if (box.dataset.grading !== "1") clearDrag(el, box)
    },
    { passive: true }
  )
}
