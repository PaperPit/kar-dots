import { describe, it, expect } from 'vitest';
import {
  getGeminiApiKey, hasGeminiApiKey,
  getGroqApiKey, hasGroqApiKey,
  withApiKeys,
} from '../js/lib/youtube-import-settings.js';

describe('youtube-import-settings', () => {
  it('читает и триммит ключи из настроек', () => {
    expect(getGeminiApiKey({ geminiApiKey: '  AIzaTest  ' })).toBe('AIzaTest');
    expect(getGroqApiKey({ groqApiKey: ' gsk_test ' })).toBe('gsk_test');
    expect(getGeminiApiKey({})).toBe('');
    expect(getGroqApiKey(null)).toBe('');
  });

  it('has*ApiKey отражает наличие непустого ключа', () => {
    expect(hasGeminiApiKey({ geminiApiKey: 'AIzaX' })).toBe(true);
    expect(hasGeminiApiKey({ geminiApiKey: '   ' })).toBe(false);
    expect(hasGroqApiKey({ groqApiKey: 'gsk_x' })).toBe(true);
    expect(hasGroqApiKey({})).toBe(false);
  });

  it('withApiKeys добавляет только заданные ключи и не мутирует исходное тело', () => {
    const body = { url: 'https://youtu.be/x' };
    const both = withApiKeys({ geminiApiKey: 'AIzaX', groqApiKey: 'gsk_y' }, body);
    expect(both).toEqual({ url: 'https://youtu.be/x', geminiApiKey: 'AIzaX', groqApiKey: 'gsk_y' });
    expect(body).toEqual({ url: 'https://youtu.be/x' });

    const onlyGroq = withApiKeys({ groqApiKey: 'gsk_y' }, body);
    expect(onlyGroq.geminiApiKey).toBe(undefined);
    expect(onlyGroq.groqApiKey).toBe('gsk_y');

    const none = withApiKeys({}, body);
    expect(none).toEqual(body);
  });
});
