import { describe, it, expect } from 'vitest';
import {
  shouldUseCardsDelta,
  mergeSrsDelta,
  nextCardsWatermark,
  stampUpdatedAt,
  cardLwwFilter,
  isMissingSyncedAtError,
  FULL_RESYNC_MS,
  SRS_DELTA_SELECT,
  SYNCED_DELTA_SELECT,
  SYNCED_AT_FIELD,
  WATERMARK_SAFETY_MS,
  LEGACY_WATERMARK_SAFETY_MS,
} from '../js/data/cloud-delta.ts';

describe('cloud-delta', () => {
  it('SRS_DELTA_SELECT includes updated_at', () => {
    expect(SRS_DELTA_SELECT).toContain('updated_at');
    expect(SRS_DELTA_SELECT).toContain('sm2_due');
  });

  it('SYNCED_DELTA_SELECT adds the server clock column', () => {
    expect(SYNCED_AT_FIELD).toBe('synced_at');
    expect(SYNCED_DELTA_SELECT).toContain('updated_at');
    expect(SYNCED_DELTA_SELECT).toContain('synced_at');
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

  it('shouldUseCardsDelta rejects a watermark built on the other clock', () => {
    const now = 1_000_000;
    const synced = { userId: 'u1', cardsAt: 100, cardsAtKind: 'synced_at', fullAt: now };
    expect(shouldUseCardsDelta(synced, 'u1', now, 'synced_at')).toBe(true);
    expect(shouldUseCardsDelta(synced, 'u1', now, 'updated_at')).toBe(false);
    // Старая запись без cardsAtKind — это клиентские часы.
    const legacy = { userId: 'u1', cardsAt: 100, fullAt: now };
    expect(shouldUseCardsDelta(legacy, 'u1', now, 'updated_at')).toBe(true);
    expect(shouldUseCardsDelta(legacy, 'u1', now, 'synced_at')).toBe(false);
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

  it('mergeSrsDelta tracks the server clock separately from the client one', () => {
    const { maxAt, maxSyncedAt } = mergeSrsDelta([], [
      { id: 'a', folder_id: 'f', sm2_reps: 1, updated_at: 500, synced_at: 900, created_at: 1 },
      // Устройство с отставшими часами: updated_at меньше, synced_at больше.
      { id: 'b', folder_id: 'f', sm2_reps: 1, updated_at: 10, synced_at: 1200, created_at: 2 },
    ]);
    expect(maxAt).toBe(500);
    expect(maxSyncedAt).toBe(1200);
  });

  it('nextCardsWatermark moves only by row timestamps, never by the clock', () => {
    // Пустая выборка не двигает watermark — иначе офлайн-правка «отстанет» навсегда.
    expect(nextCardsWatermark(200, 0)).toBe(200);
    expect(nextCardsWatermark(0, 0)).toBe(0);
    // Серверные часы: небольшой запас на строки, записанные после снимка.
    expect(nextCardsWatermark(10, 100_000, { kind: 'synced_at' }))
      .toBe(100_000 - WATERMARK_SAFETY_MS);
    // Клиентские часы: запас заведомо шире перекоса часов между устройствами.
    expect(nextCardsWatermark(10, 100_000_000, { kind: 'updated_at' }))
      .toBe(100_000_000 - LEGACY_WATERMARK_SAFETY_MS);
    expect(nextCardsWatermark(10, 100_000_000)).toBe(100_000_000 - LEGACY_WATERMARK_SAFETY_MS);
    // Watermark не откатывается назад из-за запаса.
    expect(nextCardsWatermark(99_999, 100_000, { kind: 'synced_at' })).toBe(99_999);
    expect(nextCardsWatermark(10, 40, { safetyMs: 0 })).toBe(40);
  });

  it('cardLwwFilter adds the last-write-wins guard only with a stamp', () => {
    expect(cardLwwFilter('c1', stampUpdatedAt({ front: 'a' })))
      .toMatch(/^id=eq\.c1&updated_at=lt\.\d+$/);
    expect(cardLwwFilter('c1', { front: 'a' })).toBe('id=eq.c1');
    expect(cardLwwFilter('c1', null)).toBe('id=eq.c1');
    expect(cardLwwFilter('c1', { updated_at: 0 })).toBe('id=eq.c1');
    expect(cardLwwFilter('c1', { updated_at: 'нет' })).toBe('id=eq.c1');
    expect(cardLwwFilter('c1', { updated_at: 77 })).toBe('id=eq.c1&updated_at=lt.77');
  });

  it('isMissingSyncedAtError distinguishes schema gaps from other failures', () => {
    expect(isMissingSyncedAtError(new Error('column cards.synced_at does not exist'))).toBe(true);
    expect(isMissingSyncedAtError(new Error("Could not find the 'synced_at' column in the schema cache"))).toBe(true);
    expect(isMissingSyncedAtError('42703: synced_at')).toBe(true);
    expect(isMissingSyncedAtError(new Error('Failed to fetch'))).toBe(false);
    expect(isMissingSyncedAtError(new Error('column cards.box does not exist'))).toBe(false);
    expect(isMissingSyncedAtError(new Error('synced_at conflict'))).toBe(false);
  });

  it('stampUpdatedAt sets updated_at', () => {
    const p = stampUpdatedAt({ sm2_reps: 2 });
    expect(p.sm2_reps).toBe(2);
    expect(typeof p.updated_at).toBe('number');
    expect(p.updated_at).toBeGreaterThan(0);
  });
});
