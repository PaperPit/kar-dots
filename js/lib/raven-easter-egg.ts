const GLITCH_FX = "audio/glitch-fx.mp3"
const CROW_SCREAM = "audio/crow-scream.mp3"
const FEATHER_SRC = "icons/feather.svg"
const CLICKS_NEEDED = 10
const RESET_MS = 4000
const STORM_MS = 7000
const FEATHER_COUNT = 70

let clicks = 0
let resetTimer: ReturnType<typeof setTimeout> | null = null
let glitchAudio: HTMLAudioElement | null = null
let crowAudio: HTMLAudioElement | null = null
let stormTimer: ReturnType<typeof setTimeout> | null = null
let stormOverlay: HTMLElement | null = null
let stormActive = false

function resetClicks() {
  clicks = 0
  resetTimer = null
}

function stopEggAudio() {
  for (const a of [glitchAudio, crowAudio]) {
    if (a) {
      a.pause()
      a.currentTime = 0
    }
  }
  glitchAudio = null
  crowAudio = null
}

function playCrowScream() {
  if (typeof Audio === "undefined") return
  crowAudio = new Audio(CROW_SCREAM)
  crowAudio.volume = 0.95
  crowAudio.play().catch(() => {})
}

/** Сначала глитч, по окончании — карканье вороны. */
function playEggAudio() {
  if (typeof Audio === "undefined") return
  stopEggAudio()
  try {
    glitchAudio = new Audio(GLITCH_FX)
    glitchAudio.volume = 0.9
    glitchAudio.addEventListener("ended", () => playCrowScream(), { once: true })
    glitchAudio.play().catch(() => playCrowScream())
  } catch (e) {
    playCrowScream()
  }
}

function cleanupStorm() {
  if (stormTimer) {
    clearTimeout(stormTimer)
    stormTimer = null
  }
  if (stormOverlay) {
    stormOverlay.remove()
    stormOverlay = null
  }
  if (typeof document !== "undefined") {
    document.querySelector(".brand-logo")?.classList.remove("is-raven-hidden")
  }
  stormActive = false
}

function cleanupEgg() {
  stopEggAudio()
  cleanupStorm()
}

function runFeatherStorm() {
  if (typeof document === "undefined") return
  if (stormActive) return

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  if (reduced) return

  cleanupStorm()

  const logo = document.querySelector(".brand-logo")
  logo?.classList.add("is-raven-hidden")

  const overlay = document.createElement("div")
  overlay.className = "feather-storm"
  overlay.setAttribute("aria-hidden", "true")
  stormOverlay = overlay
  stormActive = true

  for (let i = 0; i < FEATHER_COUNT; i++) {
    const f = document.createElement("img")
    f.src = FEATHER_SRC
    f.className = "feather-storm__feather"
    f.alt = ""
    f.draggable = false
    const left = Math.random() * 100
    const size = 12 + Math.random() * 32
    const dur = 1.6 + Math.random() * 3.2
    const delay = Math.random() * 3
    const x0 = (Math.random() - 0.5) * 50
    const x1 = x0 + (Math.random() - 0.5) * 140
    const r0 = Math.random() * 360
    const r1 = r0 + (Math.random() - 0.5) * 900
    f.style.left = `${left}%`
    f.style.width = `${size}px`
    f.style.height = `${size}px`
    f.style.setProperty("--dur", `${dur}s`)
    f.style.setProperty("--delay", `${delay}s`)
    f.style.setProperty("--x0", `${x0}px`)
    f.style.setProperty("--x1", `${x1}px`)
    f.style.setProperty("--r0", `${r0}deg`)
    f.style.setProperty("--r1", `${r1}deg`)
    overlay.append(f)
  }

  document.body.append(overlay)

  stormTimer = setTimeout(() => {
    cleanupStorm()
  }, STORM_MS)
}

/** Сбросить счётчик при уходе с главного экрана. */
export function syncRavenEggScreen(viewName: string) {
  if (viewName !== "home") {
    resetClicks()
    cleanupEgg()
  }
}

/**
 * Клик по бренду на главной. true — посхалка сработала, навигация не нужна.
 */
export function tryRavenEggClick() {
  clicks += 1
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(resetClicks, RESET_MS)

  if (clicks < CLICKS_NEEDED) return false

  resetClicks()
  playEggAudio()
  runFeatherStorm()
  return true
}

export { STORM_MS, FEATHER_COUNT }
