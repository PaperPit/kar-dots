import { describe, expect, it } from 'vitest';
import { pickNativeTranscript } from '../js/lib/speech-input.js';

describe('pickNativeTranscript', () => {
  it('prefers accumulatedText', () => {
    expect(pickNativeTranscript({
      accumulatedText: 'мой',
      accumulated: 'mo',
      matches: ['m'],
    })).toBe('мой');
  });

  it('falls back to matches', () => {
    expect(pickNativeTranscript({ matches: ['hello'] })).toBe('hello');
  });

  it('returns empty string when nothing heard', () => {
    expect(pickNativeTranscript({})).toBe('');
  });
});
