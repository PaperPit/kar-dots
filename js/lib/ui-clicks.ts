import { playUiClickSound, normalizeUiClickSoundId } from "./sounds.js"
import * as state from "../core/state.js"

interface UiClickSettings {
  uiClickSound?: string
}
interface StateModule {
  store?: { settings?: UiClickSettings } | null
}

const SKIP = new Set(["TEXTAREA", "SELECT"])
const SKIP_INPUT = new Set([
  "text",
  "number",
  "email",
  "password",
  "search",
  "url",
  "range",
  "file"
])

let stateMod: StateModule = state

function shouldPlayForTarget(node: EventTarget | null): boolean {
  if (!node) return false
  if (node instanceof Element && node.closest?.('[data-ui-click="off"]')) return false
  if (node instanceof Element && node.closest?.(".melody-picker-play")) return false
  const tag = node instanceof Element ? node.tagName : ''
  if (SKIP.has(tag)) return false
  if (tag === "INPUT" && node instanceof HTMLInputElement) {
    const type = (node.type || "text").toLowerCase()
    if (SKIP_INPUT.has(type)) return false
  }
  if (node instanceof HTMLElement && (node.isContentEditable || node.closest('[contenteditable="true"]'))) return false
  return !!node && node instanceof Element && node.closest(
    'button, a[href], [role="button"], [role="tab"], [role="option"], ' +
      ".tab-btn, .nav-btn, .brand, .folder-card, .box-card, .grade-btn, .match-item, " +
      ".melody-picker-trigger, .melody-picker-option, .seg button, label.chk-wrap"
  ) != null
}

let bound = false

export function initUiClicks(): void {
  if (bound || typeof document === "undefined") return
  bound = true

  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      if (!shouldPlayForTarget(e.target)) return
      const id = normalizeUiClickSoundId(stateMod.store?.settings?.uiClickSound ?? "none")
      if (id === "none") return
      playUiClickSound(id)
    },
    true
  )
}
