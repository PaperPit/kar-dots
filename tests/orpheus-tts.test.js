import { describe, it, expect } from 'vitest';
import {
  ORPHEUS_VOICES,
  normalizeOrpheusVoice,
  orpheusEnabled,
  truncateForOrpheus,
  ORPHEUS_MAX_CHARS,
  isEnglishLang,
  formatOrpheusError,
  isOrpheusTermsError,
} from '../js/lib/orpheus-tts.js';
import { ttsCacheKey } from '../js/data/tts-cache.js';

describe('orpheus-tts', () => {
  it('normalizeOrpheusVoice принимает только известные голоса', () => {
    expect(normalizeOrpheusVoice('troy')).toBe('troy');
    expect(normalizeOrpheusVoice('unknown')).toBe('hannah');
  });

  it('orpheusEnabled читает флаг настроек', () => {
    expect(orpheusEnabled({ ttsOrpheus: true })).toBe(true);
    expect(orpheusEnabled({ ttsOrpheus: false })).toBe(false);
    expect(orpheusEnabled({})).toBe(false);
  });

  it('isEnglishLang распознаёт en', () => {
    expect(isEnglishLang('en-US')).toBe(true);
    expect(isEnglishLang('ru-RU')).toBe(false);
  });

  it('truncateForOrpheus режет длинный текст', () => {
    const long = 'a'.repeat(ORPHEUS_MAX_CHARS + 10);
    expect(truncateForOrpheus(long).length).toBe(ORPHEUS_MAX_CHARS);
  });

  it('truncateForOrpheus не обрывает на середине слова', () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const cut = truncateForOrpheus(words);
    expect(cut.length).toBeLessThanOrEqual(ORPHEUS_MAX_CHARS);
    expect(cut.endsWith('word39')).toBe(false);
    expect(/\bword\d+$/.test(cut)).toBe(true);
  });

  it('ORPHEUS_VOICES содержит 6 голосов Groq', () => {
    expect(ORPHEUS_VOICES.map(v => v.id).sort()).toEqual(
      ['austin', 'autumn', 'daniel', 'diana', 'hannah', 'troy'].sort(),
    );
  });

  it('formatOrpheusError переводит terms acceptance', () => {
    expect(formatOrpheusError('requires terms acceptance')).toMatch(/Groq Console/i);
    expect(isOrpheusTermsError('accept the terms')).toBe(true);
  });
});

describe('tts-cache key', () => {
  it('стабилен для одного текста и голоса', async () => {
    const a = await ttsCacheKey('hello', 'troy');
    const b = await ttsCacheKey('hello', 'troy');
    expect(a).toBe(b);
    expect(await ttsCacheKey('hello', 'hannah')).not.toBe(a);
  });
});
