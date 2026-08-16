import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/core/state.js', () => ({
  store: {
    settings: { reviewsPerDay: 50, newPerDay: 20 },
  },
}));

let today = { reviews: 12 };

vi.mock('../js/lib/activity.js', () => ({
  dayKey: () => '2026-07-20',
  loadActivity: () => ({ days: { '2026-07-20': today } }),
  // Реальная реализация: закрепление вычитается из дневного счёта.
  scheduledReviews: (day) => Math.max(0, (day?.reviews || 0) - (day?.cram || 0)),
}));

import { reviewsPerDaySetting, reviewsBudget, reviewsTodayCount } from '../js/ui/study-budget.ts';
import { store } from '../js/core/state.js';

describe('reviewsBudget', () => {
  beforeEach(() => {
    store.settings.reviewsPerDay = 50;
    today = { reviews: 12 };
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

  it('закрепление не съедает дневной лимит', () => {
    // 60 оценок за день, из них 55 — закрепление: в лимит идут только 5.
    today = { reviews: 60, cram: 55 };
    expect(reviewsTodayCount()).toBe(5);
    expect(reviewsBudget({ reviewsPerDay: 50 })).toBe(45);
  });

  it('чистое закрепление не блокирует плановое повторение', () => {
    today = { reviews: 60, cram: 60 };
    expect(reviewsTodayCount()).toBe(0);
    expect(reviewsBudget({ reviewsPerDay: 50 })).toBe(50);
  });
});
