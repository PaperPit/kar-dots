import { describe, it, expect, beforeAll } from 'vitest';
import { fsrsNext, fsrsIsUntouched, fsrsPreviewLabel, FsrsRating } from '../js/lib/fsrs-engine.js';
import { isNew, isDue, dueOf, fsrsPreview, srsSnapshot, preloadFsrs } from '../js/lib/srs.js';

describe('FSRS engine', () => {
  it('untouched card has no fsrs fields', () => {
    expect(fsrsIsUntouched({})).toBe(true);
    expect(isNew({}, 'fsrs')).toBe(true);
  });

  it('Good schedules next review', () => {
    const now = Date.now();
    const patch = fsrsNext({}, FsrsRating.Good, now);
    expect(patch.fsrs_reps).toBe(1);
    expect(patch.fsrs_due).toBeGreaterThan(now);
    expect(isNew(patch, 'fsrs')).toBe(false);
  });

  it('Again reschedules within short interval', () => {
    const now = Date.now();
    const first = fsrsNext({}, FsrsRating.Good, now);
    const reviewAt = now + 60_000;
    const again = fsrsNext(first, FsrsRating.Again, reviewAt);
    expect(again.fsrs_due).toBeGreaterThan(reviewAt);
    expect(again.fsrs_due - reviewAt).toBeLessThan(60 * 60_000);
  });

  it('preview labels are non-empty strings', () => {
    const label = fsrsPreviewLabel({}, FsrsRating.Good);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

describe('FSRS in srs.js', () => {
  beforeAll(async () => {
    await preloadFsrs();
  });

  it('dueOf returns fsrs_due when set', () => {
    expect(dueOf({ fsrs_due: 500, fsrs_reps: 1 }, 'fsrs')).toBe(500);
    expect(dueOf({}, 'fsrs')).toBeNull();
  });

  it('isDue when fsrs_due passed', () => {
    expect(isDue({ fsrs_due: 100, fsrs_reps: 1 }, 'fsrs', 200)).toBe(true);
  });

  it('srsSnapshot captures fsrs fields', () => {
    const snap = srsSnapshot({
      fsrs_state: 2,
      fsrs_due: 1000,
      fsrs_reps: 3,
    }, 'fsrs');
    expect(snap.fsrs_reps).toBe(3);
    expect(snap.fsrs_due).toBe(1000);
  });

  it('fsrsPreview delegates to engine', () => {
    expect(typeof fsrsPreview({}, FsrsRating.Easy)).toBe('string');
  });
});

describe('FSRS review queue', () => {
  it('counts due and new separately from sm2', () => {
    const now = Date.now();
    const cards = [
      { id: '1', fsrs_reps: null, fsrs_due: null },
      { id: '2', fsrs_reps: 1, fsrs_due: now - 1000 },
      { id: '3', sm2_reps: 1, sm2_due: now - 1000 },
    ];
    expect(isNew(cards[0], 'fsrs')).toBe(true);
    expect(isDue(cards[1], 'fsrs', now)).toBe(true);
    expect(isNew(cards[2], 'fsrs')).toBe(true);
  });
});
