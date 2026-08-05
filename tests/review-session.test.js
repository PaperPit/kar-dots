// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../js/core/state.js', () => ({
  store: {
    settings: { leitnerIntervals: [1, 2, 4, 8, 16] },
    updateCard: vi.fn(async () => true),
  },
}));

vi.mock('../js/lib/activity.js', () => ({
  recordReview: vi.fn(async () => {}),
  undoReview: vi.fn(async () => {}),
}));

vi.mock('../js/lib/review-log.js', () => ({
  buildReviewEntry: vi.fn(() => ({})),
  logReview: vi.fn(async () => 'log-1'),
  removeReview: vi.fn(async () => {}),
}));

vi.mock('../js/ui/helpers.js', () => ({
  spendNewBudget: vi.fn(),
  refundNewBudget: vi.fn(),
}));

vi.mock('../js/lib/sounds.js', () => ({
  playAnswerFeedback: vi.fn(),
  unlockAnswerAudio: vi.fn(),
}));

import { applyGrade, gradePayload } from '../js/screens/review/grading.ts';
import { store } from '../js/core/state.js';

function makeCtx(queue) {
  return {
    algo: 'sm2',
    answered: 0,
    cram: false,
    currentBox: null,
    currentIsNew: false,
    currentSwipeWrap: null,
    done: 0,
    grading: false,
    pendingUndo: null,
    queue: queue.slice(),
    sessionFirstTry: new Set(),
    showNext: vi.fn(),
    showNextTimer: null,
    stage: document.createElement('div'),
    stats: { attempted: 0, firstTryOk: 0, known: 0, failed: 0 },
    trackFlipFirstTry: vi.fn(() => false),
    undoHoldUntilFlip: false,
    undoToastDismiss: null,
    updateBar: vi.fn(),
  };
}

describe('review session grade transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.updateCard.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applyGrade on success advances queue and calls showNext', async () => {
    const c1 = { id: '1', front: 'a', back: 'b', sm2_reps: 1, sm2_due: 1, sm2_ef: 2.5, sm2_ivl: 1 };
    const c2 = { id: '2', front: 'c', back: 'd', sm2_reps: 1, sm2_due: 1, sm2_ef: 2.5, sm2_ivl: 1 };
    const ctx = makeCtx([c1, c2]);
    await applyGrade(ctx, c1, gradePayload('sm2', true), { quiet: true });
    expect(ctx.queue.map((c) => c.id)).toEqual(['2']);
    expect(ctx.done).toBe(1);
    expect(ctx.answered).toBe(1);
    expect(ctx.stats.known).toBe(1);
    expect(store.updateCard).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(ctx.showNext).toHaveBeenCalledWith(false);
  });

  it('applyGrade on failure reinserts the card later in the queue', async () => {
    const c1 = { id: '1', front: 'a', back: 'b', sm2_reps: 2, sm2_due: 1, sm2_ef: 2.5, sm2_ivl: 3 };
    const c2 = { id: '2', front: 'c', back: 'd', sm2_reps: 1, sm2_due: 1, sm2_ef: 2.5, sm2_ivl: 1 };
    const c3 = { id: '3', front: 'e', back: 'f', sm2_reps: 1, sm2_due: 1, sm2_ef: 2.5, sm2_ivl: 1 };
    const ctx = makeCtx([c1, c2, c3]);
    await applyGrade(ctx, c1, gradePayload('sm2', false), { quiet: true, skipAdvance: true });
    expect(ctx.queue.map((c) => c.id)).toEqual(['2', '3', '1']);
    expect(ctx.stats.failed).toBe(1);
    expect(ctx.done).toBe(0);
  });

  it('empty queue after last success is end of deck', async () => {
    const c1 = { id: '1', front: 'a', back: 'b', sm2_reps: 0, sm2_due: null, sm2_ef: 2.5, sm2_ivl: 0 };
    const ctx = makeCtx([c1]);
    await applyGrade(ctx, c1, gradePayload('sm2', true), { quiet: true, skipAdvance: true });
    expect(ctx.queue).toHaveLength(0);
    expect(ctx.done).toBe(1);
  });
});
