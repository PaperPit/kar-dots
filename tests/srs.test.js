import { describe, it, expect } from 'vitest';
import {
  sm2Next, leitnerNext, isNew, isDue, dueOf, fmtDays, DAY, MIN,
} from '../js/lib/srs.js';

describe('SM-2', () => {
  it('новая карточка с оценкой «снова» — повтор через 10 минут', () => {
    const card = { sm2_ef: 2.5, sm2_reps: 0, sm2_ivl: 0, sm2_due: null };
    const now = 1_000_000;
    const r = sm2Next(card, 0, now);
    expect(r.sm2_reps).toBe(0);
    expect(r.sm2_due).toBe(now + 10 * MIN);
  });

  it('первая успешная оценка «хорошо» — интервал 1 день', () => {
    const card = { sm2_ef: 2.5, sm2_reps: 0, sm2_ivl: 0 };
    const now = Date.now();
    const r = sm2Next(card, 4, now);
    expect(r.sm2_reps).toBe(1);
    expect(r.sm2_ivl).toBe(1);
    expect(r.sm2_due).toBe(now + DAY);
  });

  it('«легко» на первом повторении — интервал 4 дня', () => {
    const card = { sm2_ef: 2.5, sm2_reps: 0, sm2_ivl: 0 };
    const r = sm2Next(card, 5);
    expect(r.sm2_ivl).toBe(4);
  });
});

describe('Лейтнер', () => {
  it('«не помню» отправляет в первую коробку', () => {
    const card = { box: 3, box_due: Date.now() + DAY };
    const r = leitnerNext(card, false, [1, 2, 4, 8, 16]);
    expect(r.box).toBe(1);
  });

  it('«помню» повышает коробку', () => {
    const card = { box: 2 };
    const r = leitnerNext(card, true, [1, 2, 4, 8, 16]);
    expect(r.box).toBe(3);
  });
});

describe('isNew / isDue', () => {
  it('новая карточка для SM-2', () => {
    expect(isNew({ sm2_reps: 0, sm2_due: null }, 'sm2')).toBe(true);
    expect(isDue({ sm2_reps: 1, sm2_due: 100 }, 'sm2', 200)).toBe(true);
  });

  it('новая карточка для Лейтнера', () => {
    expect(isNew({ box: 0 }, 'leitner')).toBe(true);
    expect(dueOf({ box: 2, box_due: 500 }, 'leitner')).toBe(500);
  });
});

describe('fmtDays', () => {
  it('склоняет дни по-русски', () => {
    expect(fmtDays(1)).toBe('1 день');
    expect(fmtDays(3)).toBe('3 дня');
    expect(fmtDays(5)).toBe('5 дней');
  });
});
