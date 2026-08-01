import { describe, it, expect } from 'vitest';
import {
  shiftMonth,
  isCurrentOrFutureMonth,
} from '../js/ui/activity-calendar.ts';

describe('home calendar month nav helpers', () => {
  it('shiftMonth crosses year boundary', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2025, 11, 1)).toEqual({ year: 2026, month: 0 });
  });

  it('isCurrentOrFutureMonth caps at current month', () => {
    const now = new Date(2026, 7, 15); // Aug 2026
    expect(isCurrentOrFutureMonth(2026, 7, now)).toBe(true);
    expect(isCurrentOrFutureMonth(2026, 6, now)).toBe(false);
    expect(isCurrentOrFutureMonth(2026, 8, now)).toBe(true);
    expect(isCurrentOrFutureMonth(2025, 11, now)).toBe(false);
  });
});
