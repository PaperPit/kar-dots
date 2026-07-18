import { describe, it, expect } from 'vitest';
import { parseBulkLines, countReadyRows } from '../js/lib/card-import.ts';

describe('parseBulkLines', () => {
  it('парсит em dash и дефис', () => {
    const { rows } = parseBulkLines('hello — привет\nworld - мир');
    expect(rows).toEqual([
      { front: 'hello', back: 'привет' },
      { front: 'world', back: 'мир' },
    ]);
  });

  it('игнорирует пустые строки и комментарии', () => {
    const { rows, skipped } = parseBulkLines('# заголовок\n\n  cat — кот  ');
    expect(rows).toEqual([{ front: 'cat', back: 'кот' }]);
    expect(skipped).toBe(0);
  });

  it('собирает строки только со словом', () => {
    const { rows, wordOnly } = parseBulkLines('dog\nbird — птица');
    expect(wordOnly).toEqual(['dog']);
    expect(countReadyRows(rows)).toBe(1);
  });

  it('пропускает дубликаты лицевой стороны', () => {
    const { rows, skipped } = parseBulkLines('a — 1\na — 2');
    expect(rows.length).toBe(1);
    expect(skipped).toBe(1);
  });
});
