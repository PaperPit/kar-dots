import { describe, it, expect } from 'vitest';
import {
  getSupadataApiKey, hasSupadataApiKey,
  getGeminiApiKey, hasGeminiApiKey,
  getGroqApiKey, hasGroqApiKey,
  withApiKeys, integrationsKeySummary,
} from '../js/lib/youtube-import-settings.ts';

const SUPA = 'sd_0123456789abcd';
const GEMINI = 'AQ.FakeTestKeyForKarDotsUnitTestsOnly001';
const GROQ = 'gsk_0123456789abcdef';

describe('youtube-import-settings', () => {
  it('читает и нормализует ключи из настроек', () => {
    expect(getSupadataApiKey({ supadataApiKey: `  ${SUPA}  ` })).toBe(SUPA);
    expect(getGeminiApiKey({ geminiApiKey: `  ${GEMINI}  ` })).toBe(GEMINI);
    expect(getGroqApiKey({ groqApiKey: ` ${GROQ} ` })).toBe(GROQ);
    expect(getSupadataApiKey({})).toBe('');
    expect(getGroqApiKey(null)).toBe('');
  });

  it('has*ApiKey отражает валидный ключ', () => {
    expect(hasSupadataApiKey({ supadataApiKey: SUPA })).toBe(true);
    expect(hasSupadataApiKey({ supadataApiKey: '   ' })).toBe(false);
    expect(hasGeminiApiKey({ geminiApiKey: GEMINI })).toBe(true);
    expect(hasGeminiApiKey({ geminiApiKey: 'AIzaX' })).toBe(false);
    expect(hasGroqApiKey({ groqApiKey: GROQ })).toBe(true);
    expect(hasGroqApiKey({})).toBe(false);
  });

  it('withApiKeys добавляет только заданные ключи и не мутирует исходное тело', () => {
    const body = { url: 'https://youtu.be/x' };
    const all = withApiKeys({
      supadataApiKey: SUPA,
      geminiApiKey: GEMINI,
      groqApiKey: GROQ,
    }, body);
    expect(all).toEqual({
      url: 'https://youtu.be/x',
      supadataApiKey: SUPA,
      geminiApiKey: GEMINI,
      groqApiKey: GROQ,
    });
    expect(body).toEqual({ url: 'https://youtu.be/x' });

    const onlyGroq = withApiKeys({ groqApiKey: GROQ }, body);
    expect(onlyGroq.supadataApiKey).toBe(undefined);
    expect(onlyGroq.geminiApiKey).toBe(undefined);
    expect(onlyGroq.groqApiKey).toBe(GROQ);

    const none = withApiKeys({}, body);
    expect(none).toEqual(body);
  });

  it('integrationsKeySummary показывает статус ключей', () => {
    expect(integrationsKeySummary({})).toBe('Supadata — · Gemini — · Groq —');
    expect(integrationsKeySummary({
      supadataApiKey: SUPA,
      geminiApiKey: GEMINI,
    })).toBe('Supadata ✓ · Gemini ✓ · Groq —');
  });
});
