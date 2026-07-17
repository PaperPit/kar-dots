import { describe, it, expect } from 'vitest';
import { mergeCaptionSegments, countWords } from '../js/lib/yt-segment-merge.js';

describe('countWords', () => {
  it('считает слова', () => {
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('  one   two three  ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});

describe('mergeCaptionSegments', () => {
  it('склеивает до конца предложения', () => {
    const merged = mergeCaptionSegments([
      { t: 1, text: 'Hello' },
      { t: 2, text: 'world.' },
      { t: 5, text: 'Next' },
      { t: 6, text: 'line!' },
    ]);
    expect(merged).toEqual([
      { t: 1, text: 'Hello world.', end: 2 },
      { t: 5, text: 'Next line!', end: 6 },
    ]);
  });

  it('склеивает по лимиту символов', () => {
    const merged = mergeCaptionSegments([
      { t: 0, text: 'This is a first part without ending' },
      { t: 1, text: 'and here is more text still going' },
      { t: 2, text: 'done.' },
    ], { maxChars: 40 });
    expect(merged.length).toBeGreaterThanOrEqual(2);
    expect(merged.every(m => m.text.length <= 80)).toBe(true);
  });
});
