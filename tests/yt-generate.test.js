import { describe, it, expect } from 'vitest';
import {
  alignSentenceCards, formatSentenceLines, buildSentencesPrompt,
} from '../netlify/functions/yt-generate.mjs';

describe('formatSentenceLines', () => {
  it('нумерует сегменты с таймкодом', () => {
    expect(formatSentenceLines([
      { t: 12, text: 'Hello world' },
      { t: 45, text: 'How are you' },
    ])).toEqual([
      '1. [12] Hello world',
      '2. [45] How are you',
    ]);
  });
});

describe('buildSentencesPrompt', () => {
  it('требует точное количество переводов', () => {
    const prompt = buildSentencesPrompt({
      title: 'Test',
      lang: 'en',
      segments: [{ t: 1, text: 'Hi' }, { t: 2, text: 'Bye' }],
    });
    expect(prompt).toContain('EXACTLY 2 lines');
    expect(prompt).toContain('1. [1] Hi');
  });
});

describe('alignSentenceCards', () => {
  it('берёт front и t из сегментов', () => {
    const aligned = alignSentenceCards(
      [
        { front: 'wrong', back: 'Привет', kind: 'sentence', t: 99 },
        { front: 'wrong2', back: 'Пока', kind: 'sentence' },
      ],
      [
        { t: 1, text: 'Hello' },
        { t: 5, text: 'Bye' },
      ],
    );
    expect(aligned).toEqual([
      { front: 'Hello', back: 'Привет', kind: 'sentence', level: '', pos: 'sentence', t: 1 },
      { front: 'Bye', back: 'Пока', kind: 'sentence', level: '', pos: 'sentence', t: 5 },
    ]);
  });

  it('null при несовпадении количества', () => {
    expect(alignSentenceCards([{ front: 'a', back: 'b', kind: 'sentence' }], [])).toBe(null);
    expect(alignSentenceCards([], [{ t: 1, text: 'a' }])).toBe(null);
  });
});
