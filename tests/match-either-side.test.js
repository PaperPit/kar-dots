// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

vi.mock("../js/lib/sounds.js", () => ({
  playAnswerFeedbackFromStore: vi.fn()
}))

vi.mock("../js/ui/answer-feedback.js", () => ({
  flashMatchPair: (_a, _b, _ok, onDone) => {
    onDone()
  },
  flashMatchHint: vi.fn()
}))

import { createMatchRound } from "../js/screens/review/modes/match.js"

const CARDS = [
  { id: "1", front: "pen", back: "ручка" },
  { id: "2", front: "big", back: "большой" }
]

describe("match mode either-side select", () => {
  beforeEach(() => {
    document.documentElement.lang = "ru"
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("allows selecting translation first, then term", () => {
    const widget = createMatchRound(CARDS, {
      promptSide: "front",
      onRoundComplete: vi.fn()
    })
    document.body.append(widget.box)

    widget.box.querySelector('.match-def[data-id="1"]').click()
    expect(
      widget.box.querySelector('.match-def[data-id="1"]').classList.contains("is-selected")
    ).toBe(true)

    widget.box.querySelector('.match-term[data-id="1"]').click()
    expect(widget.box.querySelector('.match-term[data-id="1"]').disabled).toBe(true)
    expect(widget.box.querySelector('.match-def[data-id="1"]').disabled).toBe(true)

    widget.destroy()
  })

  it("still allows term first, then translation", () => {
    const widget = createMatchRound(CARDS, {
      promptSide: "front",
      onRoundComplete: vi.fn()
    })
    document.body.append(widget.box)

    widget.box.querySelector('.match-term[data-id="2"]').click()
    expect(
      widget.box.querySelector('.match-term[data-id="2"]').classList.contains("is-selected")
    ).toBe(true)

    widget.box.querySelector('.match-def[data-id="2"]').click()
    expect(widget.box.querySelector('.match-term[data-id="2"]').disabled).toBe(true)
    expect(widget.box.querySelector('.match-def[data-id="2"]').disabled).toBe(true)

    widget.destroy()
  })
})
