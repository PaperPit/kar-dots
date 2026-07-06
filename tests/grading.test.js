// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/core/state.js', () => ({
  store: { settings: { leitnerIntervals: [1, 2, 4, 8, 16] } },
}));

import { gradePayload } from '../js/screens/review/grading.js';

describe('gradePayload', () => {
  it('sm2 know / again', () => {
    expect(gradePayload('sm2', true)).toEqual({ q: 4 });
    expect(gradePayload('sm2', false)).toEqual({ q: 0 });
  });

  it('leitner remember / forget', () => {
    expect(gradePayload('leitner', true)).toEqual({ leitner: true });
    expect(gradePayload('leitner', false)).toEqual({ leitner: false });
  });

  it('fsrs maps swipe to Again / Good', () => {
    expect(gradePayload('fsrs', false)).toEqual({ fsrs: 1 });
    expect(gradePayload('fsrs', true)).toEqual({ fsrs: 3 });
  });

  it('fsrs accepts explicit rating', () => {
    expect(gradePayload('fsrs', 4)).toEqual({ fsrs: 4 });
  });
});
