interface MatchResult {
  know?: boolean
}

/** Progress delta after a Mix-mode match batch (countAsOne). Each card counts toward answered; successes toward done. */
export function comboMatchBatchProgress(results: MatchResult[]): { answeredAdd: number; doneAdd: number } {
  return {
    answeredAdd: results.length,
    doneAdd: results.filter((r) => r.know).length
  }
}

/** Bar counter shown on finish — always full session length (успешно закрытые). */
export function finishProgressAnswered(sessionTotal: number): number {
  return sessionTotal
}

/** Сколько сегментов прогресса закрасить: только успешно закрытые, не все ответы. */
export function progressShown(done: number, sessionTotal: number): number {
  return Math.min(Math.max(0, done), sessionTotal)
}
