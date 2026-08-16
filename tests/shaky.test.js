import { describe, it, expect } from 'vitest';
import {
  computeShakiness,
  isShaky,
  shakyCardIds,
  orderByShakiness,
  medianByFormat,
  SHAKY_THRESHOLD,
} from '../js/lib/shaky.ts';

let seq = 0;
function entry(cardId, { known = 1, ms = 3000, format = 'type', ts } = {}) {
  seq += 1;
  return {
    id: 'e' + seq,
    ts: ts ?? seq * 1000,
    card_id: cardId,
    folder_id: 'f',
    algo: 'fsrs',
    rating: known ? 3 : 1,
    known,
    elapsed_days: 1,
    state_before: 2,
    stability_before: 5,
    duration_ms: ms,
    format,
  };
}

describe('медиана считается по каждому формату отдельно', () => {
  it('переворот карточки не смешивается с набором текста', () => {
    const rows = [
      entry('a', { ms: 1000, format: 'flip' }),
      entry('b', { ms: 1200, format: 'flip' }),
      entry('c', { ms: 8000, format: 'type' }),
      entry('d', { ms: 10000, format: 'type' }),
    ];
    const med = medianByFormat(rows);
    expect(med.get('flip')).toBe(1100);
    expect(med.get('type')).toBe(9000);
  });

  it('провалы и слишком короткие замеры в медиану не идут', () => {
    const rows = [
      entry('a', { ms: 4000 }),
      entry('b', { ms: 100 }), // шум
      entry('c', { known: 0, ms: 50000 }), // промах
    ];
    expect(medianByFormat(rows).get('type')).toBe(4000);
  });
});

describe('шаткость', () => {
  it('стабильно верные и быстрые ответы — не шаткая', () => {
    const rows = Array.from({ length: 6 }, () => entry('a', { ms: 3000 }));
    const stat = computeShakiness(rows).get('a');
    expect(stat.score).toBe(0);
    expect(isShaky(stat)).toBe(false);
  });

  it('половина промахов — шаткая', () => {
    const rows = [
      entry('a', { known: 0 }),
      entry('a', { known: 1 }),
      entry('a', { known: 0 }),
      entry('a', { known: 1 }),
    ];
    const stat = computeShakiness(rows).get('a');
    expect(stat.fails).toBe(2);
    expect(stat.score).toBe(0.5);
    expect(isShaky(stat)).toBe(true);
  });

  it('верно, но стабильно медленнее своей нормы — тоже сигнал', () => {
    // Норма формата задаётся другими карточками, «a» отвечает втрое дольше.
    const rows = [
      entry('b', { ms: 2000 }),
      entry('c', { ms: 2000 }),
      entry('d', { ms: 2000 }),
      entry('a', { ms: 9000 }),
      entry('a', { ms: 9000 }),
      entry('a', { ms: 9000 }),
    ];
    const stat = computeShakiness(rows).get('a');
    expect(stat.fails).toBe(0);
    expect(stat.slows).toBe(3);
    // Медленный ответ весит вдвое меньше промаха: 3 / (2*3) = 0.5
    expect(stat.score).toBe(0.5);
    expect(isShaky(stat)).toBe(true);
  });

  it('промах весит вдвое против медленного ответа', () => {
    const base = [entry('x', { ms: 2000 }), entry('y', { ms: 2000 })];
    const oneFail = computeShakiness([...base, entry('a', { known: 0 })]).get('a');
    const oneSlow = computeShakiness([...base, entry('a', { ms: 9000 })]).get('a');
    expect(oneFail.score).toBe(2 * oneSlow.score);
  });

  it('учитываются только последние повторения — старое не тянет вечно', () => {
    const old = Array.from({ length: 8 }, () => entry('a', { known: 0 }));
    const fresh = Array.from({ length: 8 }, () => entry('a', { known: 1, ms: 3000 }));
    const stat = computeShakiness([...old, ...fresh]).get('a');
    expect(stat.seen).toBe(8);
    expect(stat.score).toBe(0);
  });

  it('единичный промах на фоне удач порога не берёт', () => {
    // 1 промах из 3 → 2/6 = 0.333 при пороге 0.34. Случайная осечка не
    // должна навешивать ярлык на здоровую карточку.
    const rows = [
      entry('a', { known: 0 }),
      entry('a', { known: 1, ms: 3000 }),
      entry('a', { known: 1, ms: 3000 }),
    ];
    expect(isShaky(computeShakiness(rows).get('a'))).toBe(false);
  });

  it('карточка без журнала шаткой не считается', () => {
    expect(isShaky(computeShakiness([]).get('нет-такой'))).toBe(false);
    expect(isShaky(undefined)).toBe(false);
    expect(isShaky(SHAKY_THRESHOLD)).toBe(true);
  });
});

describe('порядок показа', () => {
  it('шаткие поднимаются в начало, самые шаткие — первыми', () => {
    const rows = [
      entry('calm', { ms: 2000 }),
      // bad: два промаха из двух → 1.0
      entry('bad', { known: 0 }),
      entry('bad', { known: 0 }),
      // meh: один промах из двух → 0.5
      entry('meh', { known: 0 }),
      entry('meh', { known: 1, ms: 2000 }),
    ];
    const stats = computeShakiness(rows);
    const queue = [{ id: 'calm' }, { id: 'new' }, { id: 'meh' }, { id: 'bad' }];
    expect(orderByShakiness(queue, stats).map((c) => c.id)).toEqual([
      'bad', 'meh', 'calm', 'new',
    ]);
  });

  it('нет шатких — очередь не трогаем вовсе', () => {
    const queue = [{ id: 'a' }, { id: 'b' }];
    expect(orderByShakiness(queue, new Map())).toBe(queue);
  });

  it('shakyCardIds отдаёт только перешагнувших порог', () => {
    const rows = [
      entry('bad', { known: 0 }),
      entry('bad', { known: 0 }),
      entry('ok', { ms: 2000 }),
    ];
    expect(shakyCardIds(rows)).toEqual(new Set(['bad']));
  });
});
