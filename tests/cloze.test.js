import { describe, it, expect } from 'vitest';
import {
  clozeLettersToHide,
  clozeWordsToHide,
  buildClozeText,
  canBuildCloze,
  checkClozeAnswer,
  clozeSeed,
  isClozePhrase,
  formatClozeReveal,
} from '../js/lib/cloze.js';

describe('clozeLettersToHide', () => {
  it('1 буква для коротких слов, 2 для длинных', () => {
    expect(clozeLettersToHide(1)).toBe(0);
    expect(clozeLettersToHide(2)).toBe(1);
    expect(clozeLettersToHide(4)).toBe(1);
    expect(clozeLettersToHide(5)).toBe(2);
  });
});

describe('clozeWordsToHide', () => {
  it('1–2 слова во фразе', () => {
    expect(clozeWordsToHide(2)).toBe(1);
    expect(clozeWordsToHide(3)).toBe(1);
    expect(clozeWordsToHide(5)).toBe(2);
  });
});

describe('isClozePhrase', () => {
  it('различает слово, фразу и синонимы', () => {
    expect(isClozePhrase('hello')).toBe(false);
    expect(isClozePhrase('good morning')).toBe(true);
    expect(isClozePhrase('тёмный / мрачный / угрюмый')).toBe(false);
  });
});

describe('buildClozeText — синонимы', () => {
  it('пропускает буквы в одном варианте, не скрывает слово целиком', () => {
    const r = buildClozeText('тёмный / мрачный / угрюмый', { seed: 99 });
    expect(r.mode).toBe('letters');
    expect(r.plain).toContain(' / ');
    expect(r.plain).not.toContain('___');
    expect(r.hasBlanks).toBe(true);
    expect(r.hiddenLetters.length).toBeGreaterThan(0);
  });

  it('синонимы через пробел при однословном промпте — буквы в одном слове', () => {
    const r = buildClozeText('тёмный мрачный угрюмый', { seed: 99, promptText: 'dark' });
    expect(r.mode).toBe('letters');
    expect(r.plain).toContain(' / ');
    expect(r.plain).not.toContain('___');
    expect(r.hiddenLetters.length).toBeGreaterThan(0);
  });
});

describe('buildClozeText — слово (буквы)', () => {
  it('пропускает буквы и сохраняет hiddenLetters', () => {
    const a = buildClozeText('hello', { seed: 42 });
    expect(a.mode).toBe('letters');
    expect(a.hasBlanks).toBe(true);
    expect(a.plain).toMatch(/_/);
    expect(a.hiddenLetters.length).toBeGreaterThan(0);
    const reconstructed = a.segments.map(s => (s.hidden ? s.answer : s.ch)).join('');
    expect(reconstructed).toBe('hello');
  });

  it('стабилен при одном seed', () => {
    const s = clozeSeed('привет', 'card-1');
    expect(buildClozeText('привет', { seed: s }).plain)
      .toBe(buildClozeText('привет', { seed: s }).plain);
  });
});

describe('buildClozeText — фраза (слова)', () => {
  it('скрывает целое слово, не буквы', () => {
    const r = buildClozeText('good morning', { seed: 1 });
    expect(r.mode).toBe('words');
    expect(r.hasBlanks).toBe(true);
    expect(r.hiddenWords.length).toBe(1);
    expect(r.plain).toContain('___');
    expect(r.plain).not.toMatch(/g__d|m__ning/);
  });

  it('не ломает пунктуацию', () => {
    const r = buildClozeText('hello, world!', { seed: 7 });
    expect(r.mode).toBe('words');
    expect(r.plain).toContain(',');
    expect(r.plain).toContain('!');
  });
});

describe('checkClozeAnswer', () => {
  it('принимает только пропущенные буквы', () => {
    const cloze = {
      mode: 'letters',
      hasBlanks: true,
      hiddenLetters: ['l', 'l'],
    };
    expect(checkClozeAnswer('ll', cloze).ok).toBe(true);
    expect(checkClozeAnswer('hello', cloze).ok).toBe(false);
  });

  it('принимает только пропущенные слова', () => {
    const cloze = {
      mode: 'words',
      hasBlanks: true,
      hiddenWords: ['morning'],
    };
    expect(checkClozeAnswer('morning', cloze).ok).toBe(true);
    expect(checkClozeAnswer('good morning', cloze).ok).toBe(false);
  });

  it('несколько пропущенных слов — через пробел', () => {
    const cloze = {
      mode: 'words',
      hasBlanks: true,
      hiddenWords: ['quick', 'fox'],
    };
    expect(checkClozeAnswer('quick fox', cloze).ok).toBe(true);
  });
});

describe('formatClozeReveal', () => {
  it('форматирует буквы и слова', () => {
    expect(formatClozeReveal({ mode: 'letters', hiddenLetters: ['a', 'b'] })).toBe('ab');
    expect(formatClozeReveal({ mode: 'words', hiddenWords: ['a', 'b'] })).toBe('a · b');
  });
});

describe('canBuildCloze', () => {
  it('false для слишком коротких ответов', () => {
    expect(canBuildCloze('a')).toBe(false);
    expect(canBuildCloze('')).toBe(false);
  });

  it('true для слова ≥2 букв', () => {
    expect(canBuildCloze('go')).toBe(true);
  });

  it('true для фразы', () => {
    expect(canBuildCloze('to be')).toBe(true);
  });

  it('true для синонимов', () => {
    expect(canBuildCloze('тёмный / мрачный')).toBe(true);
  });
});
