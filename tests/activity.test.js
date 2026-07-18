import { describe, it, expect } from 'vitest';
import { calcVisitStreak, dayHasActivity } from '../js/lib/activity.ts';

describe('activity streak', () => {
  it('dayHasActivity учитывает повторения без флага visit', () => {
    const data = { days: { '2026-07-04': { reviews: 3 } } };
    expect(dayHasActivity(data, '2026-07-04')).toBe(true);
  });

  it('серия считает день с повторениями', () => {
    const today = new Date();
    const k = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const data = { days: { [k]: { reviews: 5 } } };
    expect(calcVisitStreak(data)).toBe(1);
  });
});
