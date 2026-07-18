import { el, CROW_SVG, stripHtml } from "./ui.js"
import { Folder, Box, Card } from "./types.js"
import { lessonStarsLabel } from "../lib/lesson-stars.js"
import { folderIconSrc, folderHasCustomIcon } from "../lib/folder-icons.js"

export const ICON_SRC = {
  ghost: "icons/ghost.svg",
  emptyCage: "icons/empty%20cage.svg",
  crowTomb: "icons/The%20crow%20with%20the%20tombstone.svg",
  scarecrow: "icons/Scarecrow.svg",
  feather: "icons/feather.svg",
  cup: "icons/cup.svg",
  star: "icons/star.svg"
}

export function svgNode(svgText: string): HTMLElement {
  const d = document.createElement("div")
  d.innerHTML = svgText
  const node = d.firstChild
  return node as HTMLElement
}

function iconImg(name: keyof typeof ICON_SRC, cls?: string) {
  return el("img", { class: cls, src: ICON_SRC[name], alt: "", draggable: "false" })
}

export function ghostBox() {
  return iconImg("ghost", "auth-logo icon-float")
}

export function emptyFoldersBox() {
  return iconImg("emptyCage", "empty-icon")
}

export function emptyCardsBox() {
  return iconImg("emptyCage", "empty-icon")
}

export function scarecrowBox(cls?: string) {
  return iconImg("scarecrow", cls || "review-hero-icon")
}

export function featherIcon(cls?: string) {
  return iconImg("feather", cls || "app-icon")
}

export function folderIconNode(iconId?: string | null) {
  return el("img", {
    class: "folder-icon-glyph",
    src: folderIconSrc(iconId),
    alt: "",
    draggable: "false"
  })
}

export function folderSwatch(folder: Folder, { compact = false } = {}): HTMLElement {
  const letter = !folderHasCustomIcon(folder.icon)
  return el(
    "div",
    {
      class:
        "swatch" +
        (compact ? " swatch-compact swatch-compact-size" : "") +
        (letter ? " swatch-letter" : ""),
      style: { background: folder.color }
    },
    letter ? initials(folder.name) : folderIconNode(folder.icon)
  )
}

export function boxSwatch(box: Box, { compact = false } = {}): HTMLElement {
  const letter = !folderHasCustomIcon(box.icon)
  return el(
    "div",
    {
      class:
        "swatch box-swatch" +
        (compact ? " swatch-compact swatch-compact-size" : "") +
        (letter ? " swatch-letter" : ""),
      style: { background: box.color }
    },
    letter ? initials(box.name) : folderIconNode(box.icon)
  )
}

export function crowTombIcon(cls?: string) {
  return iconImg("crowTomb", cls || "modal-illus-img crow-tomb-illus")
}

export function crowBox(cls?: string) {
  return el("div", { class: cls || "crow", html: CROW_SVG })
}

export function cupBox(cls?: string) {
  return iconImg("cup", cls || "trophy-drop")
}

export function trophyBox() {
  return cupBox("trophy-drop")
}

export function lessonRewardBox(earnedStars?: number) {
  const n = Math.min(3, Math.max(1, earnedStars || 1))
  const stars = el("div", {
    class: "lesson-stars",
    "data-count": String(n),
    role: "img",
    "aria-label": `${n} из 3`
  })
  for (let i = 1; i <= n; i++) {
    stars.append(
      el("img", {
        class: `lesson-star earned star-${i}`,
        src: ICON_SRC.star,
        alt: "",
        draggable: "false"
      })
    )
  }
  return el("div", { class: "lesson-reward" }, [
    cupBox("trophy-drop"),
    stars,
    el("p", { class: "lesson-stars-label" }, lessonStarsLabel(n))
  ])
}

export function initials(name?: string) {
  return (name || "?").trim().slice(0, 1).toUpperCase()
}

export function textPreview(c: Card) {
  const front = stripHtml(c.front).replace(/\s+/g, " ").trim()
  const back = stripHtml(c.back).replace(/\s+/g, " ").trim()
  const t = front + (back ? " — " + back : "")
  return t.length > 80 ? t.slice(0, 80) + "…" : t
}
