import { describe, it, expect } from 'vitest';
import { pickRowMetrics } from '../js/lib/virtual-list.ts';

const fallback = { rowHeight: 70, gap: 10 };

describe('pickRowMetrics', () => {
  it('uses measured values, rounded to whole pixels', () => {
    expect(pickRowMetrics({ rowHeight: 69.6, gap: 10.2 }, fallback)).toEqual({ rowHeight: 70, gap: 10 });
    expect(pickRowMetrics({ rowHeight: 66, gap: 8 }, fallback)).toEqual({ rowHeight: 66, gap: 8 });
  });

  it('falls back when there is nothing to measure', () => {
    expect(pickRowMetrics(null, fallback)).toEqual(fallback);
    expect(pickRowMetrics(undefined, fallback)).toEqual(fallback);
    expect(pickRowMetrics({}, fallback)).toEqual(fallback);
  });

  it('rejects garbage from getComputedStyle / getBoundingClientRect', () => {
    // Скрытый список даёт нулевую высоту, а `row-gap: normal` → NaN после
    // parseFloat. Оба случая должны оставлять запасные значения.
    expect(pickRowMetrics({ rowHeight: 0, gap: 10 }, fallback)).toEqual(fallback);
    expect(pickRowMetrics({ rowHeight: 70, gap: NaN }, fallback)).toEqual(fallback);
    expect(pickRowMetrics({ rowHeight: NaN, gap: NaN }, fallback)).toEqual(fallback);
    expect(pickRowMetrics({ rowHeight: Infinity, gap: 4 }, fallback)).toEqual({ rowHeight: 70, gap: 4 });
    expect(pickRowMetrics({ rowHeight: -70, gap: -4 }, fallback)).toEqual(fallback);
  });

  it('keeps a zero gap (список без зазора — валидная вёрстка)', () => {
    expect(pickRowMetrics({ rowHeight: 66, gap: 0 }, fallback)).toEqual({ rowHeight: 66, gap: 0 });
  });
});
