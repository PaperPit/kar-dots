/**
 * Анимации обратной связи для режимов «Ввод», «Голос» и «Пары».
 */

export function flashStudyCard(cardEl: HTMLElement | null, isCorrect: boolean): void {
  if (!cardEl) return
  const cls = isCorrect ? "answer-flash-correct" : "answer-flash-wrong"
  cardEl.classList.remove("answer-flash-correct", "answer-flash-wrong")
  void cardEl.offsetWidth
  cardEl.classList.add(cls)
  cardEl.addEventListener("animationend", () => cardEl.classList.remove(cls), { once: true })
}

export function showStudyFeedback(el: HTMLElement | null, isCorrect: boolean, text: string): void {
  if (!el) return
  el.hidden = false
  el.className = `study-feedback is-enter ${isCorrect ? "is-correct" : "is-wrong"}`
  const row = Object.assign(document.createElement("span"), {
    className: "answer-feedback-row"
  })
  row.append(
    Object.assign(document.createElement("span"), {
      className: "answer-feedback-icon",
      ariaHidden: "true",
      textContent: isCorrect ? "✓" : "✕"
    }),
    Object.assign(document.createElement("span"), {
      className: "answer-feedback-text",
      textContent: text
    })
  )
  el.replaceChildren(row)
}

export function pulseStudyInput(inputEl: HTMLElement | null, isCorrect: boolean): void {
  if (!inputEl) return
  inputEl.classList.remove("is-animating")
  void inputEl.offsetWidth
  inputEl.classList.add("is-animating")
  inputEl.addEventListener("animationend", () => inputEl.classList.remove("is-animating"), {
    once: true
  })
  if (isCorrect) inputEl.classList.add("is-correct")
  else inputEl.classList.add("is-wrong")
}

export function flashMatchPair(termEl: HTMLElement | null, defEl: HTMLElement | null, isCorrect: boolean, onDone: () => void): void {
  const nodes = [termEl, defEl].filter((x): x is HTMLElement => x != null)
  const cls = isCorrect ? "match-pair-success" : "match-pair-wrong"
  nodes.forEach((n) => {
    n.classList.remove("match-pair-success", "match-pair-wrong", "match-shake")
    void n.offsetWidth
    n.classList.add(cls)
    if (!isCorrect) n.classList.add("match-shake")
  })
  setTimeout(onDone, isCorrect ? 440 : 400)
}

export function flashMatchHint(hintEl: HTMLElement | null, isCorrect: boolean): void {
  if (!hintEl) return
  const cls = isCorrect ? "match-hint-success" : "match-hint-wrong"
  hintEl.classList.remove("match-hint-success", "match-hint-wrong")
  void hintEl.offsetWidth
  hintEl.classList.add(cls)
  hintEl.addEventListener("animationend", () => hintEl.classList.remove(cls), { once: true })
}
