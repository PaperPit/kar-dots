/** Progress delta after a Mix-mode match batch (countAsOne). Each card counts toward answered; successes toward done. */
export function comboMatchBatchProgress(results) {
  return {
    answeredAdd: results.length,
    doneAdd: results.filter(r => r.know).length,
  };
}

/** Bar counter shown on finish — always full session length. */
export function finishProgressAnswered(sessionTotal) {
  return sessionTotal;
}
