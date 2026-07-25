import { describe, it, expect } from 'vitest';
import { convertAlgoPatch } from '../js/lib/srs-convert.ts';
import { isNew, dueOf } from '../js/lib/srs.ts';

describe('srs-convert', () => {
  const now = 1_700_000_000_000;

  it('SM-2 → FSRS сидирует stability/due, не трогает sm2_*', () => {
    const card = {
      id: 'c1',
      sm2_ef: 2.5,
      sm2_reps: 3,
      sm2_ivl: 10,
      sm2_due: now + 5 * 86400000,
    };
    expect(isNew(card, 'fsrs')).toBe(true);
    const patch = convertAlgoPatch(card, 'sm2', 'fsrs');
    expect(patch).toBeTruthy();
    expect(patch.fsrs_stability).toBe(10);
    expect(patch.fsrs_due).toBe(card.sm2_due);
    expect(patch.fsrs_reps).toBe(3);
    const merged = { ...card, ...patch };
    expect(isNew(merged, 'fsrs')).toBe(false);
    expect(dueOf(merged, 'fsrs')).toBe(card.sm2_due);
    expect(merged.sm2_ivl).toBe(10);
  });

  it('не перезаписывает уже заполненный целевой алгоритм', () => {
    const card = {
      sm2_reps: 2, sm2_ivl: 6, sm2_due: now,
      fsrs_reps: 1, fsrs_due: now + 1000, fsrs_state: 2,
    };
    expect(convertAlgoPatch(card, 'sm2', 'fsrs')).toBeNull();
  });

  it('FSRS → SM-2 из scheduled_days', () => {
    const card = {
      fsrs_reps: 4,
      fsrs_stability: 12,
      fsrs_scheduled_days: 15,
      fsrs_difficulty: 5,
      fsrs_due: now + 1000,
      fsrs_state: 2,
    };
    const patch = convertAlgoPatch(card, 'fsrs', 'sm2');
    expect(patch.sm2_ivl).toBe(15);
    expect(patch.sm2_due).toBe(card.fsrs_due);
  });

  it('Leitner → FSRS по box interval', () => {
    const card = { box: 3, box_due: now + 86400000 };
    const patch = convertAlgoPatch(card, 'leitner', 'fsrs', { leitnerIntervals: [1, 2, 4, 8, 16] });
    expect(patch.fsrs_stability).toBe(4);
    expect(patch.fsrs_due).toBe(card.box_due);
  });
});
