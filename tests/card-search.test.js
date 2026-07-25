import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCardSearchIndex, matchesSearchIndex } from '../js/lib/card-search.ts';
import { debounce } from '../js/lib/debounce.ts';

describe('cardSearchText / search index', () => {
  it('strips HTML and lowercases once', () => {
    const { hay, plains } = buildCardSearchIndex([
      { id: 'x', front: '<b>Hello</b>', back: 'Мир', description: '<i>Note</i>' },
    ]);
    expect(hay.get('x')).toBe('hello мир note');
    expect(plains.get('x')).toEqual({ front: 'Hello', back: 'Мир' });
  });

  it('matches against precomputed index without re-parsing', () => {
    const cards = [
      { id: '1', front: '<p>Cat</p>', back: 'кот', description: '' },
      { id: '2', front: 'Dog', back: 'пёс', description: 'animal' },
    ];
    const { hay } = buildCardSearchIndex(cards);
    expect(matchesSearchIndex(hay, '1', 'cat')).toBe(true);
    expect(matchesSearchIndex(hay, '1', 'пёс')).toBe(false);
    expect(matchesSearchIndex(hay, '2', 'animal')).toBe(true);
    expect(matchesSearchIndex(hay, '2', '')).toBe(true);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once after quiet period', () => {
    const fn = vi.fn();
    const d = debounce(fn, 180);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(180);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
