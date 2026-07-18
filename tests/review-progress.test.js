import { describe, it, expect } from 'vitest';
import { comboMatchBatchProgress, finishProgressAnswered } from '../js/lib/review-progress.ts';

describe('comboMatchBatchProgress', () => {
  it('counts each card toward answered and successes toward done', () => {
    const results = [
      { know: true },
      { know: true },
      { know: false },
      { know: true },
      { know: false },
    ];
    expect(comboMatchBatchProgress(results)).toEqual({ answeredAdd: 5, doneAdd: 3 });
  });

  it('10-card cram: one 5-card match batch + 5 singles → 10 answered', () => {
    let answered = 0;
    const matchBatch = Array.from({ length: 5 }, () => ({ know: true }));
    const { answeredAdd: matchAnswered } = comboMatchBatchProgress(matchBatch);
    answered += matchAnswered;
    for (let i = 0; i < 5; i++) answered += 1;
    expect(answered).toBe(10);
  });
});

describe('finishProgressAnswered', () => {
  it('returns session total for finish screen bar', () => {
    expect(finishProgressAnswered(10)).toBe(10);
  });
});
