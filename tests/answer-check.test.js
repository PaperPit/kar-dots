import { describe, it, expect, vi } from 'vitest';
import {
  normalizeAnswer,
  answersMatch,
  getExpectedAnswer,
  formatExpectedDisplay,
  expectedVariants,
  cardHasCheckableBack,
  checkCardAnswer,
} from '../js/lib/answer-check.ts';

describe('normalizeAnswer', () => {
  it('убирает пунктуацию и регистр', () => {
    expect(normalizeAnswer('  Hello, World!  ')).toBe('hello world');
    expect(normalizeAnswer('Как дела?')).toBe('как дела');
    expect(normalizeAnswer('Как дела ?')).toBe('как дела');
    expect(answersMatch('Как дела', 'Как дела ?')).toBe(true);
    expect(answersMatch('как дела', 'Как дела ？')).toBe(true);
  });
});

describe('answersMatch', () => {
  it('точное совпадение', () => {
    expect(answersMatch('hello', 'hello')).toBe(true);
    expect(answersMatch('hello', 'world')).toBe(false);
  });

  it('несколько вариантов через слэш', () => {
    expect(answersMatch('hi', 'hello / hi')).toBe(true);
    expect(answersMatch('привет', 'здравствуйте / привет')).toBe(true);
  });

  it('несколько вариантов через запятую', () => {
    expect(answersMatch('привет', 'здравствуйте, привет')).toBe(true);
  });

  it('formatExpectedDisplay', () => {
    expect(formatExpectedDisplay('огонь / пламя')).toBe('огонь / пламя');
    expect(expectedVariants('огонь / пламя / костёр')).toHaveLength(3);
  });

  it('fuzzy для опечаток', () => {
    expect(answersMatch('helo', 'hello', { fuzzy: true })).toBe(true);
  });

  it('русская морфология: занят → занятой', () => {
    expect(answersMatch('занят', 'занятой')).toBe(true);
    expect(answersMatch('занята', 'занятой')).toBe(true);
  });

  it('промах принимается для miss', () => {
    expect(answersMatch('промах', 'скучать / пропустить / промах')).toBe(true);
  });
});

describe('card answer', () => {
  const card = { front: 'hello', back: 'привет', description: '' };

  it('ожидает back при вопросе front', () => {
    expect(getExpectedAnswer(card, 'front')).toBe('привет');
    expect(getExpectedAnswer(card, 'back')).toBe('hello');
  });

  it('checkCardAnswer', () => {
    expect(checkCardAnswer('привет', card, 'front').ok).toBe(true);
    expect(checkCardAnswer('wrong', card, 'front').ok).toBe(false);
  });

  it('cardHasCheckableBack', () => {
    expect(cardHasCheckableBack(card)).toBe(true);
    expect(cardHasCheckableBack({ front: 'x', back: '', description: 'note' })).toBe(false);
  });
});

describe('study-modes routes', () => {
  it('parseReviewRoute', async () => {
    const { parseReviewRoute, buildReviewHash, resolveStudyMode, setSessionStudyMode, setLastStudyMode } = await import('../js/lib/study-modes.ts');
    expect(parseReviewRoute(['review'])).toEqual({ folderId: null, cram: false, mode: 'flip', cramLimit: null });
    expect(parseReviewRoute(['review', 'type'])).toEqual({ folderId: null, cram: false, mode: 'type', cramLimit: null });
    expect(parseReviewRoute(['review', 'voice'])).toEqual({ folderId: null, cram: false, mode: 'voice', cramLimit: null });
    expect(parseReviewRoute(['review', 'combo'])).toEqual({ folderId: null, cram: false, mode: 'combo', cramLimit: null });
    expect(parseReviewRoute(['review', 'abc', 'type'])).toEqual({ folderId: 'abc', cram: false, mode: 'type', cramLimit: null });
    expect(parseReviewRoute(['review', 'abc', 'cram', 'voice'])).toEqual({ folderId: 'abc', cram: true, mode: 'voice', cramLimit: null });
    expect(parseReviewRoute(['review', 'abc', 'cram', '20', 'combo'])).toEqual({ folderId: 'abc', cram: true, mode: 'combo', cramLimit: 20 });
    expect(parseReviewRoute(['review', 'abc', 'cram', '20'])).toEqual({ folderId: 'abc', cram: true, mode: 'flip', cramLimit: 20 });
    expect(buildReviewHash('abc', { mode: 'match' })).toBe('#review/abc/match');
    expect(buildReviewHash('abc', { cram: true, mode: 'type' })).toBe('#review/abc/cram/type');
    expect(buildReviewHash(null, { mode: 'combo' })).toBe('#review/combo');
    const ss = {};
    const ls = {};
    vi.stubGlobal('sessionStorage', {
      getItem: k => (k in ss ? ss[k] : null),
      setItem: (k, v) => { ss[k] = v; },
      removeItem: k => { delete ss[k]; },
    });
    vi.stubGlobal('localStorage', {
      getItem: k => (k in ls ? ls[k] : null),
      setItem: (k, v) => { ls[k] = v; },
      removeItem: k => { delete ls[k]; },
    });
    setSessionStudyMode('match');
    expect(resolveStudyMode('flip')).toBe('match');
    setLastStudyMode('combo');
    expect(resolveStudyMode('flip')).toBe('combo');
    setLastStudyMode('flip');
    expect(resolveStudyMode('combo')).toBe('combo');
    setLastStudyMode('flip');
    expect(resolveStudyMode('flip')).toBe('flip');
    expect(resolveStudyMode('type')).toBe('type');
    vi.unstubAllGlobals();
  });
});
