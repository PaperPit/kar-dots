const EASE = [0.22, 0.9, 0.3, 1]
const DUR = 0.3
const STAGGER_CAP = 12

type AnimateFn = (
  el: HTMLElement,
  keyframes: Record<string, unknown>,
  options: Record<string, unknown>,
) => { finished: Promise<unknown> }

let animateFn: AnimateFn | null = null
let animateLoading: Promise<AnimateFn | null> | null = null

async function loadAnimate(): Promise<AnimateFn | null> {
  if (animateFn) return animateFn
  if (!animateLoading) {
    animateLoading = import('../vendor/motion.mjs')
      .then((m) => {
        animateFn = m.animate as AnimateFn
        return animateFn
      })
      .catch((err) => {
        console.warn('motion load failed', err)
        return null
      })
  }
  return animateLoading
}

export function motionEnabled(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

async function run(
  el: HTMLElement | null,
  keyframes: Record<string, unknown>,
  options: Record<string, unknown>,
): Promise<void> {
  if (!el) return
  const animate = await loadAnimate()
  if (!animate) return
  return animate(el, keyframes, options).finished.catch(() => {}) as Promise<void>
}

export function initMotionUi(): void {
  document.documentElement.classList.add('motion-ui')
}

export function animateViewIn(el: HTMLElement | null): void | Promise<void> {
  if (!el || !motionEnabled()) return
  el.style.animation = 'none'
  const touch = window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches
  const keyframes = touch ? { opacity: [0, 1] } : { opacity: [0, 1], y: [10, 0] }
  return run(el, keyframes, { duration: DUR, ease: EASE }).then(() => {
    el.style.transform = ''
  })
}

export function animateFadeIn(el: HTMLElement | null): void | Promise<void> {
  if (!el || !motionEnabled()) return
  el.style.animation = 'none'
  return run(el, { opacity: [0, 1], y: [8, 0] }, { duration: DUR, ease: EASE })
}

export function staggerIn(parent: HTMLElement | null, selector = '.stagger-in'): void {
  const kids = parent ? Array.from(parent.querySelectorAll<HTMLElement>(selector)) : []
  if (!kids.length || !motionEnabled()) return
  kids.forEach((el) => {
    el.style.animation = 'none'
  })
  const animated = kids.slice(0, STAGGER_CAP)
  const rest = kids.slice(STAGGER_CAP)
  rest.forEach((el) => {
    el.style.opacity = '1'
  })
  animated.forEach((el) => {
    el.style.opacity = '0'
  })
  animated.forEach((el, i) => {
    void run(el, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, delay: i * 0.04, ease: EASE })
  })
}

export function animateModalIn(overlay: HTMLElement, box: HTMLElement): Promise<void> {
  if (!motionEnabled()) {
    overlay.classList.add('open')
    return Promise.resolve()
  }
  overlay.style.opacity = '0'
  box.style.transform = 'translateY(18px) scale(0.97)'
  overlay.classList.add('open')
  return Promise.all([
    run(overlay, { opacity: [0, 1] }, { duration: 0.26, ease: EASE }),
    run(box, { y: [18, 0], scale: [0.97, 1] }, { duration: 0.26, ease: EASE }),
  ]).then(() => {})
}

export function animateModalOut(overlay: HTMLElement, box: HTMLElement): Promise<void> {
  if (!motionEnabled()) {
    overlay.classList.remove('open')
    return new Promise((resolve) => setTimeout(resolve, 260))
  }
  return Promise.all([
    run(overlay, { opacity: [1, 0] }, { duration: 0.22, ease: EASE }),
    run(box, { y: [0, 12], scale: [1, 0.97] }, { duration: 0.22, ease: EASE }),
  ]).then(() => {})
}

export function animateToastIn(t: HTMLElement): void | Promise<void> {
  if (!motionEnabled()) {
    requestAnimationFrame(() => t.classList.add('show'))
    return
  }
  t.style.transition = 'none'
  t.style.opacity = '0'
  t.style.transform = 'translateY(14px) scale(0.96)'
  t.classList.add('show')
  void run(t, { opacity: [0, 1], y: [14, 0], scale: [0.96, 1] }, { duration: 0.3, ease: EASE })
}

export function animateToastOut(t: HTMLElement): void | Promise<void> {
  if (!motionEnabled()) {
    t.classList.remove('show')
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
    () => splash.remove(),
  )
}
