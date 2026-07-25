// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { gradeKeyIndex } from '../js/screens/review/flip-card.ts';

describe('gradeKeyIndex', () => {
  it('maps 1..4 to zero-based button indexes', () => {
    expect(gradeKeyIndex('1')).toBe(0);
    expect(gradeKeyIndex('2')).toBe(1);
    expect(gradeKeyIndex('3')).toBe(2);
    expect(gradeKeyIndex('4')).toBe(3);
  });

  it('ignores non-grade keys', () => {
    expect(gradeKeyIndex('0')).toBe(null);
    expect(gradeKeyIndex('5')).toBe(null);
    expect(gradeKeyIndex('a')).toBe(null);
    expect(gradeKeyIndex(' ')).toBe(null);
    expect(gradeKeyIndex('')).toBe(null);
  });

  it('ignores multi-char key names (Enter, ArrowLeft, …)', () => {
    expect(gradeKeyIndex('Enter')).toBe(null);
    expect(gradeKeyIndex('ArrowLeft')).toBe(null);
    // «12» никогда не приходит как KeyboardEvent.key, но проверка длины важна:
    // без неё indexOf нашёл бы подстроку и вернул бы индекс 0.
    expect(gradeKeyIndex('12')).toBe(null);
  });
});
