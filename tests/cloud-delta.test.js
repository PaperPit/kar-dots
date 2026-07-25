import { describe, it, expect } from 'vitest';
import {
  shouldUseCardsDelta,
  mergeSrsDelta,
  nextCardsWatermark,
  stampUpdatedAt,
  lwwUpdateFilter,
  resolveSettingsLww,
  FULL_RESYNC_MS,
  SRS_DELTA_SELECT,
} from '../js/data/cloud-delta.ts';

describe('cloud-delta', () => {
  it('SRS_DELTA_SELECT includes updated_at', () => {
    expect(SRS_DELTA_SELECT).toContain('updated_at');
    expect(SRS_DELTA_SELECT).toContain('sm2_due');
  });

  it('shouldUseCardsDelta requires matching user + watermark + fresh fullAt', () => {
    const now = 1_000_000;
    expect(shouldUseCardsDelta(null, 'u1', now)).toBe(false);
    expect(shouldUseCardsDelta({ userId: 'other', cardsAt: 10, fullAt: now }, 'u1', now)).toBe(false);
    expect(shouldUseCardsDelta({ userId: 'u1', cardsAt: 0, fullAt: now }, 'u1', now)).toBe(false);
    expect(shouldUseCardsDelta({ userId: 'u1', cardsAt: 100, fullAt: now }, 'u1', now)).toBe(true);
    expect(shouldUseCardsDelta(
      { userId: 'u1', cardsAt: 100, fullAt: now - FULL_RESYNC_MS - 1 },
      'u1',
      now,
    )).toBe(false);
  });

  it('mergeSrsDelta upserts and tracks max updated_at', () => {
    const base = [
      { id: 'a', folder_id: 'f', sm2_reps: 1, created_at: 1 },
      { id: 'b', folder_id: 'f', sm2_reps: 0, created_at: 2 },
    ];
    const { meta, maxAt } = mergeSrsDelta(base, [
      { id: 'a', folder_id: 'f', sm2_reps: 5, updated_at: 50, created_at: 1 },
      { id: 'c', folder_id: 'f', sm2_reps: 0, updated_at: 80, created_at: 3 },
    ]);
    expect(meta).toHaveLength(3);
    expect(meta.find(c => c.id === 'a').sm2_reps).toBe(5);
    expect(meta.find(c => c.id === 'c')).toBeTruthy();
    expect(maxAt).toBe(80);
  });

  it('mergeSrsDelta не затирает более свежую локальную meta', () => {
    const base = [
      { id: 'a', folder_id: 'f', sm2_reps: 9, updated_at: 100, created_at: 1 },
    ];
    const { meta, maxAt } = mergeSrsDelta(base, [
      { id: 'a', folder_id: 'f', sm2_reps: 1, updated_at: 40, created_at: 1 },
    ]);
    expect(meta.find(c => c.id === 'a').sm2_reps).toBe(9);
    expect(maxAt).toBe(40);
  });

  it('nextCardsWatermark prefers row max else advances clock', () => {
    expect(nextCardsWatermark(10, 40, 100)).toBe(40);
    expect(nextCardsWatermark(10, 0, 100)).toBe(100);
    expect(nextCardsWatermark(200, 0, 100)).toBe(200);
  });

  it('stampUpdatedAt sets updated_at', () => {
    const p = stampUpdatedAt({ sm2_reps: 2 });
    expect(p.sm2_reps).toBe(2);
    expect(typeof p.updated_at).toBe('number');
    expect(p.updated_at).toBeGreaterThan(0);
  });

  it('lwwUpdateFilter добавляет updated_at=lte при stamp', () => {
    expect(lwwUpdateFilter('c1', { updated_at: 42 })).toBe('id=eq.c1&updated_at=lte.42');
    expect(lwwUpdateFilter('c1', {})).toBe('id=eq.c1');
  });

  it('resolveSettingsLww выбирает более свежий blob', () => {
    expect(resolveSettingsLww({ a: 1 }, 10, { a: 2 }, 20).source).toBe('remote');
    expect(resolveSettingsLww({ a: 1 }, 30, { a: 2 }, 20).source).toBe('local');
    expect(resolveSettingsLww({ a: 1 }, 10, { a: 2 }, 10).source).toBe('remote');
  });
});
