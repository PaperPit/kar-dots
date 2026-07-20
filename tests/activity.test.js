import { describe, it, expect } from 'vitest';
import { calcVisitStreak, dayHasActivity, dayKnownFailed, dayHeatLevel, mergeActivity } from '../js/lib/activity.ts';

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

describe('dayKnownFailed / dayHeatLevel', () => {
  it('legacy reviews без split считаются known', () => {
    expect(dayKnownFailed({ reviews: 7 })).toEqual({ known: 7, failed: 0 });
    expect(dayKnownFailed({ known: 3, failed: 2, reviews: 5 })).toEqual({ known: 3, failed: 2 });
    expect(dayHeatLevel(0)).toBe(0);
    expect(dayHeatLevel(3)).toBe(1);
    expect(dayHeatLevel(10)).toBe(2);
    expect(dayHeatLevel(20)).toBe(3);
  });
});

describe('mergeActivity', () => {
  it('берёт максимумы по дням для синка устройств', () => {
    const a = { days: { '2026-07-19': { visit: true, reviews: 10, known: 8, failed: 2 } } };
    const b = { days: { '2026-07-19': { reviews: 3, known: 3 }, '2026-07-18': { visit: true, reviews: 1 } } };
    expect(mergeActivity(a, b)).toEqual({
      days: {
        '2026-07-19': { visit: true, reviews: 10, known: 8, failed: 2 },
        '2026-07-18': { visit: true, reviews: 1 },
      },
    });
  });
});
