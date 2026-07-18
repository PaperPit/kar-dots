import { el } from "./ui.js"
import {
  getTranslateDir,
  setTranslateDir,
  translateDirLabel,
  flipTranslateDir
} from "../lib/translate.js"

const FLIP_MS = 320

/** Компактная кнопка направления перевода с анимацией переворота. */
export function createTranslateDirToggle(initialDir = getTranslateDir()) {
  let dir = initialDir
  const label = el("span", { class: "translate-dir-toggle-label" }, translateDirLabel(dir))
  const btn = el(
    "button",
    {
      type: "button",
      class: "btn translate-dir-toggle",
      title: "Нажмите, чтобы сменить направление"
    },
    label
  )

  btn.addEventListener("click", () => {
    if (btn.classList.contains("is-flipping")) return
    dir = flipTranslateDir(dir)
    setTranslateDir(dir)
    btn.classList.add("is-flipping")
    setTimeout(() => {
      label.textContent = translateDirLabel(dir)
    }, FLIP_MS / 2)
    btn.addEventListener(
      "animationend",
      () => {
        btn.classList.remove("is-flipping")
      },
      { once: true }
    )
  })

  return { btn, getDir: () => dir }
}
