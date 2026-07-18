import { describe, it, expect } from 'vitest';
import {
  detectSpeechLang,
  speechLangPrefix,
  scoreSpeechVoice,
  pickBestSpeechVoice,
  resolveSpeechVoice,
  formatSpeechVoiceLabel,
  listSpeechVoicesForLang,
  clampSpeechRate,
} from '../js/lib/web-speech-tts.ts';

const VOICES = [
  { name: 'Milena', lang: 'ru-RU', voiceURI: 'ru-milena', localService: true },
  { name: 'Compact Ru', lang: 'ru-RU', voiceURI: 'ru-compact', localService: true },
  { name: 'Samantha', lang: 'en-US', voiceURI: 'en-samantha', localService: true },
  { name: 'Alex', lang: 'en-US', voiceURI: 'en-alex', localService: true },
];

describe('web-speech-tts', () => {
  it('detectSpeechLang определяет ru и en', () => {
    expect(detectSpeechLang('привет')).toBe('ru-RU');
    expect(detectSpeechLang('hello')).toBe('en-US');
    expect(detectSpeechLang('123')).toBe('ru-RU');
  });

  it('speechLangPrefix', () => {
    expect(speechLangPrefix('en-US')).toBe('en');
    expect(speechLangPrefix('ru-RU')).toBe('ru');
  });

  it('pickBestSpeechVoice предпочитает качественные голоса', () => {
    expect(pickBestSpeechVoice(VOICES, 'ru')?.voiceURI).toBe('ru-milena');
    expect(pickBestSpeechVoice(VOICES, 'en')?.voiceURI).toBe('en-samantha');
  });

  it('resolveSpeechVoice использует сохранённый URI', () => {
    const v = resolveSpeechVoice(VOICES, 'en-US', 'en-alex');
    expect(v?.voiceURI).toBe('en-alex');
  });

  it('resolveSpeechVoice игнорирует URI другого языка', () => {
    const v = resolveSpeechVoice(VOICES, 'ru-RU', 'en-alex');
    expect(v?.voiceURI).toBe('ru-milena');
  });

  it('listSpeechVoicesForLang фильтрует по префиксу', () => {
    expect(listSpeechVoicesForLang(VOICES, 'en').map(v => v.voiceURI)).toEqual(['en-alex', 'en-samantha']);
  });

  it('formatSpeechVoiceLabel', () => {
    expect(formatSpeechVoiceLabel({ name: 'Milena', lang: 'ru_RU', localService: true })).toBe('Milena (ru-RU)');
    expect(formatSpeechVoiceLabel({ name: 'Google EN', lang: 'en-US', localService: false })).toContain('online');
  });

  it('scoreSpeechVoice штрафует compact', () => {
    expect(scoreSpeechVoice({ name: 'Compact Ru', lang: 'ru-RU' }))
      .toBeLessThan(scoreSpeechVoice({ name: 'Milena', lang: 'ru-RU' }));
  });

  it('clampSpeechRate ограничивает 0.5–2', () => {
    expect(clampSpeechRate(3)).toBe(2);
    expect(clampSpeechRate(0.1)).toBe(0.5);
    expect(clampSpeechRate(null)).toBe(1);
  });
});
