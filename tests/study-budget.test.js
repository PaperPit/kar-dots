import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/core/state.js', () => ({
  store: {
    settings: { reviewsPerDay: 50, newPerDay: 20 },
  },
}));

vi.mock('../js/lib/activity.js', () => ({
  dayKey: () => '2026-07-20',
  loadActivity: () => ({ days: { '2026-07-20': { reviews: 12 } } }),
}));

import { reviewsPerDaySetting, reviewsBudget, reviewsTodayCount } from '../js/ui/study-budget.ts';
import { store } from '../js/core/state.js';

describe('reviewsBudget', () => {
  beforeEach(() => {
    store.settings.reviewsPerDay = 50;
  });

  it('reviewsPerDaySetting fallback 50 и минимум 1', () => {
    expect(reviewsPerDaySetting({ reviewsPerDay: 50 })).toBe(50);
    expect(reviewsPerDaySetting({ reviewsPerDay: 0 })).toBe(50);
    expect(reviewsPerDaySetting({ reviewsPerDay: -3 })).toBe(50);
    expect(reviewsPerDaySetting({})).toBe(50);
    expect(reviewsPerDaySetting({ reviewsPerDay: 80 })).toBe(80);
  });

  it('reviewsBudget = лимит − уже сделанные сегодня', () => {
    expect(reviewsTodayCount()).toBe(12);
    expect(reviewsBudget({ reviewsPerDay: 50 })).toBe(38);
    expect(reviewsBudget({ reviewsPerDay: 10 })).toBe(0);
  });
});
