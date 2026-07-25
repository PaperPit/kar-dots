import { describe, it, expect, vi } from 'vitest';
import {
  computeVisibleRange,
  VIRTUAL_LIST_THRESHOLD,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_GAP,
} from '../js/lib/virtual-list.ts';

describe('computeVisibleRange', () => {
  const base = {
    rowHeight: DEFAULT_ROW_HEIGHT,
    gap: DEFAULT_GAP,
    overscan: 2,
    totalItems: 100,
    listOffset: 400,
    viewportHeight: 800,
  };

  it('uses CSS-aligned defaults (70 + 8 = 78 stride)', () => {
    expect(DEFAULT_ROW_HEIGHT).toBe(70);
    expect(DEFAULT_GAP).toBe(8);
    expect(computeVisibleRange({ ...base, totalItems: 0, scrollTop: 0 }).stride).toBe(78);
  });

  it('returns empty range for zero items', () => {
    expect(computeVisibleRange({ ...base, totalItems: 0, scrollTop: 0 })).toEqual({
      start: 0, end: 0, stride: 78,
    });
  });

  it('computes start/end for scrolled viewport', () => {
    const r = computeVisibleRange({ ...base, scrollTop: 500 });
    expect(r.start).toBeGreaterThanOrEqual(0);
    expect(r.end).toBeLessThanOrEqual(100);
    expect(r.end).toBeGreaterThan(r.start);
  });

  it('expands range with overscan', () => {
    const tight = computeVisibleRange({ ...base, scrollTop: 500, overscan: 0 });
    const wide = computeVisibleRange({ ...base, scrollTop: 500, overscan: 5 });
    expect(wide.start).toBeLessThanOrEqual(tight.start);
    expect(wide.end).toBeGreaterThanOrEqual(tight.end);
  });

  it('shows top slice when list is below fold', () => {
    const r = computeVisibleRange({ ...base, scrollTop: 0, listOffset: 2000 });
    expect(r.start).toBe(0);
    expect(r.end).toBe(0);
  });
});

describe('VIRTUAL_LIST_THRESHOLD', () => {
  it('is a reasonable cutoff', () => {
    expect(VIRTUAL_LIST_THRESHOLD).toBeGreaterThan(20);
    expect(VIRTUAL_LIST_THRESHOLD).toBeLessThan(200);
  });
});
