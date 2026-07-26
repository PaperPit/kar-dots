import { el, sanitizeRich, stripHtml } from "./ui.js"
import { Card } from "./types.js"
import { resolveImageUrl, resolveImageUrlSync } from "../data/image-url.js"

/**
 * Картинка стороны карточки в обёртке фиксированной высоты.
 * Место под неё занято ещё до загрузки файла, поэтому текст под картинкой
 * не подпрыгивает, когда изображение наконец декодируется.
 *
 * Бакет card-images приватный, поэтому сначала рисуем то, что уже есть в кэше
 * подписей (или исходную ссылку), а затем меняем src на свежую подпись.
 */
function faceImage(src: string): HTMLElement {
  const img = el("img", { src: resolveImageUrlSync(src), alt: "", decoding: "async" })
  void resolveImageUrl(src).then(url => {
    if (url && img.getAttribute("src") !== url) img.setAttribute("src", url)
  })
  return el("div", { class: "card-img-box" }, [img])
}

/** Лицевая сторона: термин + опциональная картинка. */
export function buildFrontContent(card: Card): HTMLElement[] {
  const parts = []
  if (card.front_img) parts.push(faceImage(card.front_img))
  const plain = stripHtml(card.front)
  if (plain) {
    const sizeCls = plain.length > 160 ? " long" : plain.length > 60 ? " small" : ""
    const wordNode = el("div", { class: "word" + sizeCls })
    wordNode.innerHTML = sanitizeRich(card.front)
    parts.push(wordNode)
  }
  return parts
}

/** Оборот: определение (жирное, по центру) + описание (мельче, по ширине). */
export function buildBackContent(card: Card): HTMLElement[] {
  const parts = []
  if (card.back_img) parts.push(faceImage(card.back_img))

  const defPlain = stripHtml(card.back)
  if (defPlain) {
    const longCls = defPlain.length > 120 ? " long" : ""
    const defNode = el("div", { class: "card-definition" + longCls })
    defNode.textContent = defPlain
    parts.push(defNode)
  }

  const desc = (card.description || "").trim()
  if (desc) {
    const descNode = el("div", { class: "card-description" })
    descNode.innerHTML = sanitizeRich(desc)
    parts.push(descNode)
  }

  if (!parts.length) {
    parts.push(el("div", { class: "card-definition muted" }, "(пусто)"))
  }
  return parts
}

export function buildFaceScroll(side: "front" | "back", card: Card): HTMLElement {
  const content = side === "front" ? buildFrontContent(card) : buildBackContent(card)
  return el("div", { class: "flip-face-scroll" }, content)
}

export function buildFlipFace(side: "front" | "back", card: Card, isBackFace: boolean): HTMLElement {
  const chip = el(
    "div",
    { class: "flip-side-chip" + (isBackFace ? " is-back" : " is-front") },
    isBackFace ? "Перевод" : "Слово"
  )
  return el("div", { class: "flip-face" + (isBackFace ? " backside" : "") }, [
    chip,
    buildFaceScroll(side, card)
  ])
}

/** Плоский текст описания для textarea. */
export function descriptionPlain(card: Card): string {
  return String(card.description || "").trim()
}
