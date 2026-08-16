import type { SrsCard } from "../../../lib/srs.js"
import type { Settings } from "../../../lib/sounds.js"
import { el } from "../../../ui/ui.js"
import { buildFaceScroll } from "../../../ui/card-face.js"
import {
  checkCardAnswer,
  formatExpectedDisplay,
  getExpectedAnswer
} from "../../../lib/answer-check.js"
import { playAnswerFeedback, unlockAnswerAudio } from "../../../lib/sounds.js"
import { flashStudyCard, showStudyFeedback, pulseStudyInput } from "../../../ui/answer-feedback.js"
import { haptic } from "../../../ui/helpers.js"
import { focusWithoutScroll } from "../../../lib/study-keyboard.js"
import { t } from "../../../lib/i18n.js"

interface TypeModeCtx {
  promptSide: "front" | "back"
  onSuccess: (r: { firstTry: boolean }) => void
  onFail: (r?: { firstTry?: boolean }) => void
  getSettings: () => Settings | null
}

function buildPrompt(card: SrsCard, promptSide: "front" | "back") {
  return el("div", { class: "study-prompt-card" }, [buildFaceScroll(promptSide, card)])
}

export function createTypeModeCard(card: SrsCard, ctx: TypeModeCtx) {
  const { promptSide, onSuccess, onFail, getSettings } = ctx
  let answered = false
  let revealed = false
  let attempts = 0

  const prompt = buildPrompt(card, promptSide)
  const answerLabel =
    promptSide === "front" ? t("review.type.placeholderBack") : t("review.type.placeholderFront")
  const input = el(
    "input",
    {
      type: "text",
      class: "input study-answer-input",
      placeholder: answerLabel,
      "aria-label": answerLabel,
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false"
    },
    undefined
  ) as HTMLInputElement

  const feedback = el("div", { class: "study-feedback", hidden: true }, undefined)
  const hint = el("p", { class: "study-hint" }, t("review.type.hint")) as HTMLElement
  const statusSlot = el("div", { class: "study-status-slot" }, [hint, feedback])
  const actions = el("div", { class: "study-actions" }, undefined)
  const checkBtn = el(
    "button",
    { type: "button", class: "btn primary study-check-btn" },
    t("review.type.check")
  ) as HTMLButtonElement
  const dontKnowBtn = el(
    "button",
    {
      type: "button",
      class: "btn ghost study-dont-know-btn"
    },
    t("review.type.dontKnow")
  ) as HTMLButtonElement

  function hasAnswer() {
    return input.value.trim().length > 0
  }

  function syncCheckBtn() {
    checkBtn.disabled = answered || revealed || !hasAnswer()
    dontKnowBtn.disabled = answered || revealed
  }

  function showStatus(isCorrect: boolean, text: string) {
    hint.hidden = true
    showStudyFeedback(feedback, isCorrect, text)
  }

  function restoreHint() {
    feedback.hidden = true
    feedback.replaceChildren()
    feedback.className = "study-feedback"
    hint.hidden = false
  }

  function playFeedback(isCorrect: boolean) {
    playAnswerFeedback(isCorrect, getSettings?.())
  }

  function setState(state: string) {
    input.classList.remove("is-correct", "is-wrong", "is-animating")
    if (state === "correct") input.classList.add("is-correct")
    if (state === "wrong") input.classList.add("is-wrong")
  }

  function goNextAsFail() {
    if (answered) return
    answered = true
    onFail({ firstTry: false })
  }

  /** Показать перевод, запретить ввод, ждать «Далее». */
  function revealAnswer(expected: string, { quiet = false }: { quiet?: boolean } = {}) {
    if (answered || revealed) return
    revealed = true
    const settings = getSettings?.()
    if (settings) unlockAnswerAudio(settings)
    if (!quiet) {
      playFeedback(false)
      haptic(4)
      flashStudyCard(prompt, false)
    }
    setState("")
    input.value = ""
    input.disabled = true
    input.hidden = true
    showStatus(false, t("review.type.correctIs", { answer: formatExpectedDisplay(expected) }))
    actions.innerHTML = ""
    actions.append(
      el(
        "button",
        {
          type: "button",
          class: "btn primary study-check-btn study-next-btn",
          onclick: goNextAsFail
        },
        t("review.type.next")
      )
    )
  }

  function showWrong(expected: string) {
    showStatus(false, t("review.type.wrong"))
    actions.innerHTML = ""
    const revealBtn = el(
      "button",
      {
        type: "button",
        class: "btn ghost study-reveal-btn"
      },
      t("review.type.showAnswer")
    )
    revealBtn.addEventListener("click", () => revealAnswer(expected, { quiet: true }))
    syncCheckBtn()
    actions.append(checkBtn, revealBtn, dontKnowBtn)
  }

  function check() {
    if (answered || revealed || !hasAnswer()) return
    const settings = getSettings?.()
    if (settings) unlockAnswerAudio(settings)
    attempts++
    const firstTry = attempts === 1
    const { ok, expected } = checkCardAnswer(input.value, card, promptSide, { fuzzy: true })
    if (ok) {
      answered = true
      playFeedback(true)
      haptic(10)
      pulseStudyInput(input, true)
      flashStudyCard(prompt, true)
      showStatus(true, t("review.type.correct"))
      input.disabled = true
      checkBtn.disabled = true
      dontKnowBtn.disabled = true
      setTimeout(() => onSuccess({ firstTry }), 560)
    } else {
      playFeedback(false)
      haptic(4)
      pulseStudyInput(input, false)
      flashStudyCard(prompt, false)
      showWrong(expected)
      focusWithoutScroll(input)
    }
  }

  checkBtn.addEventListener("click", check)
  dontKnowBtn.addEventListener("click", () => {
    const alreadyWrong = !feedback.hidden && feedback.classList.contains("is-wrong")
    revealAnswer(getExpectedAnswer(card, promptSide), { quiet: alreadyWrong })
  })
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      check()
    }
  })
  input.addEventListener("input", () => {
    syncCheckBtn()
    if (input.classList.contains("is-wrong")) {
      setState("")
      restoreHint()
    }
  })

  syncCheckBtn()
  actions.append(checkBtn, dontKnowBtn)

  const box = el("div", { class: "study-type-card" }, [prompt, statusSlot, input, actions])

  requestAnimationFrame(() => {
    requestAnimationFrame(() => focusWithoutScroll(input))
  })

  return {
    box,
    getPromptSide: () => promptSide,
    destroy() {}
  }
}
