import { describe, it, expect } from 'vitest';
import { computeLessonStars, lessonStarsLabel, lessonFinishTitle } from '../js/lib/lesson-stars.js';

describe('computeLessonStars', () => {
  it('by first try ratio for all modes', () => {
    expect(computeLessonStars({ mode: 'type', stats: { firstTryOk: 10 }, sessionCards: 10 })).toBe(3);
    expect(computeLessonStars({ mode: 'type', stats: { firstTryOk: 9 }, sessionCards: 10 })).toBe(3);
    expect(computeLessonStars({ mode: 'voice', stats: { firstTryOk: 6 }, sessionCards: 10 })).toBe(2);
    expect(computeLessonStars({ mode: 'flip', stats: { firstTryOk: 3 }, sessionCards: 10 })).toBe(1);
    expect(computeLessonStars({ mode: 'combo', stats: { firstTryOk: 3 }, sessionCards: 10 })).toBe(1);
  });
});

describe('lessonStarsLabel', () => {
  it('formats count', () => {
    expect(lessonStarsLabel(2)).toBe('2 из 3');
  });
});

describe('lessonFinishTitle', () => {
  it('returns title by star count', () => {
    expect(lessonFinishTitle(3)).toContain('великолепен');
    expect(lessonFinishTitle(2)).toContain('верную сторону');
    expect(lessonFinishTitle(1)).toBe('Ворон не улетает — попробуй ещё раз');
  });
});
