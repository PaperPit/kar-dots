import { describe, it, expect } from 'vitest';
import {
  clozeLettersToHide,
  buildClozeText,
  canBuildCloze,
  clozeSeed,
} from '../js/lib/cloze.js';

describe('clozeLettersToHide', () => {
  it('1 буква для коротких слов, 2 для длинных', () => {
    expect(clozeLettersToHide(1)).toBe(0);
    expect(clozeLettersToHide(2)).toBe(1);
    expect(clozeLettersToHide(4)).toBe(1);
    expect(clozeLettersToHide(5)).toBe(2);
    expect(clozeLettersToHide(12)).toBe(2);
  });
});

describe('buildClozeText', () => {
  it('пропускает 1–2 буквы и сохраняет пробелы', () => {
    const a = buildClozeText('hello world', { seed: 42 });
    expect(a.hasBlanks).toBe(true);
    expect(a.plain).toMatch(/_/);
    const reconstructed = a.segments.map(s => (s.hidden ? s.answer : s.ch)).join('');
    expect(reconstructed).toBe('hello world');

    const hiddenCount = a.segments.filter(s => s.hidden).length;
    expect(hiddenCount).toBeGreaterThanOrEqual(2);
    expect(hiddenCount).toBeLessThanOrEqual(4);
  });

  it('стабилен при одном seed', () => {
    const s = clozeSeed('привет', 'card-1');
    const a = buildClozeText('привет', { seed: s });
    const b = buildClozeText('привет', { seed: s });
    expect(a.plain).toBe(b.plain);
  });

  it('обрабатывает фразы по словам', () => {
    const r = buildClozeText('good morning', { seed: 1 });
    expect(r.plain).toContain(' ');
    expect(r.hasBlanks).toBe(true);
  });

  it('не ломает пунктуацию', () => {
    const r = buildClozeText('hello, world!', { seed: 7 });
    expect(r.plain).toContain(',');
    expect(r.plain).toContain('!');
  });
});

describe('canBuildCloze', () => {
  it('false для слишком коротких ответов', () => {
    expect(canBuildCloze('a')).toBe(false);
    expect(canBuildCloze('')).toBe(false);
  });

  it('true если есть слово ≥2 букв', () => {
    expect(canBuildCloze('go')).toBe(true);
    expect(canBuildCloze('to be')).toBe(true);
  });
});
