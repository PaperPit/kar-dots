import { describe, it, expect, vi } from 'vitest';
import { isRealReview, toOptimizerCsv } from '../js/lib/fsrs-optimize.ts';
import { buildLogEntry, gradePayload } from '../js/screens/review/grading.ts';
import { DAY } from '../js/lib/srs.ts';

vi.mock('../js/core/state.js', () => ({
  store: { settings: { leitnerIntervals: [1, 2, 4, 8, 16] } },
}));

describe('review log elapsed_days + synthetic', () => {
  const now = 1_700_000_000_000;

  it('SM-2: elapsed = now - (due - ivl), synthetic=true', () => {
    const card = {
      id: 'c1', folder_id: 'f',
      sm2_reps: 2, sm2_ivl: 10, sm2_due: now - 2 * DAY,
    };
    const entry = buildLogEntry(
      { algo: 'sm2' },
      card,
      gradePayload('sm2', true),
      false,
      now,
    );
    expect(entry.synthetic).toBe(true);
    // lastApprox = due - 10d = now - 12d → elapsed ≈ 12
    expect(entry.elapsed_days).toBeCloseTo(12, 5);
    expect(isRealReview(entry)).toBe(false);
  });

  it('FSRS: elapsed from last_review, not synthetic', () => {
    const card = {
      id: 'c1', folder_id: 'f',
      fsrs_state: 2, fsrs_reps: 3, fsrs_due: now,
      fsrs_stability: 5, fsrs_last_review: now - 3 * DAY,
    };
    const entry = buildLogEntry(
      { algo: 'fsrs' },
      card,
      gradePayload('fsrs', 3),
      false,
      now,
    );
    expect(entry.synthetic).toBeUndefined();
    expect(entry.elapsed_days).toBeCloseTo(3, 5);
    expect(isRealReview(entry)).toBe(true);
  });

  it('toOptimizerCsv drops synthetic rows', () => {
    const csv = toOptimizerCsv([
      { id: '1', card_id: 'a', ts: 1, rating: 3, state_before: 2, synthetic: true },
      { id: '2', card_id: 'b', ts: 2, rating: 3, state_before: 2 },
    ]);
    expect(csv).toContain('b,2,3,2');
    expect(csv).not.toContain('a,1');
  });
});
