import { describe, it, expect } from 'vitest';
import { cleanGeminiApiKey, cleanGroqApiKey } from '../js/lib/llm-api-keys.js';
import { combineLlmErrors, formatGeminiGenerateError } from '../js/lib/gemini-generate.js';

describe('llm-api-keys', () => {
  it('cleanGeminiApiKey принимает AIza…', () => {
    expect(cleanGeminiApiKey(' AIzaSyAbc123_def-456 ')).toBe('AIzaSyAbc123_def-456');
  });

  it('cleanGeminiApiKey принимает новый Auth key AQ.…', () => {
    const key = 'AQ.FakeTestKeyForKarDotsUnitTestsOnly001';
    expect(cleanGeminiApiKey(key)).toBe(key);
  });

  it('cleanGeminiApiKey отклоняет мусор', () => {
    expect(cleanGeminiApiKey('not-a-key')).toBe('');
  });

  it('cleanGroqApiKey принимает gsk_…', () => {
    expect(cleanGroqApiKey('gsk_abc123XYZ0123456789')).toBe('gsk_abc123XYZ0123456789');
  });
});

describe('gemini-generate errors', () => {
  it('combineLlmErrors показывает оба провайдера', () => {
    const msg = combineLlmErrors('Неверный ключ', 'Groq blocked');
    expect(msg).toMatch(/Gemini:/);
    expect(msg).toMatch(/Groq/);
  });

  it('formatGeminiGenerateError переводит invalid key', () => {
    expect(formatGeminiGenerateError('API key not valid')).toMatch(/AI Studio/i);
  });
});
