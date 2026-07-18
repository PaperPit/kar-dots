import { describe, it, expect } from 'vitest';
import {
  groqModelsToTry,
  isGroqModelBlocked,
  shouldTryNextGroqModel,
  formatGroqGenerateError,
  GROQ_GENERATE_MODELS,
} from '../js/lib/groq-generate.ts';

describe('groq-generate', () => {
  it('groqModelsToTry ставит env-модель первой', () => {
    const chain = groqModelsToTry('openai/gpt-oss-20b');
    expect(chain[0]).toBe('openai/gpt-oss-20b');
    expect(chain).toContain('openai/gpt-oss-120b');
  });

  it('groqModelsToTry без override содержит gpt-oss до llama', () => {
    const chain = groqModelsToTry('');
    expect(chain.indexOf('openai/gpt-oss-120b')).toBeLessThan(chain.indexOf('llama-3.3-70b-versatile'));
    expect(chain.length).toBe(GROQ_GENERATE_MODELS.length);
  });

  it('isGroqModelBlocked распознаёт project block', () => {
    expect(isGroqModelBlocked('blocked at the project level')).toBe(true);
  });

  it('shouldTryNextGroqModel при block — да, при 401 — нет', () => {
    expect(shouldTryNextGroqModel(400, 'blocked at the project level')).toBe(true);
    expect(shouldTryNextGroqModel(401, 'invalid api key')).toBe(false);
    expect(shouldTryNextGroqModel(429, 'rate limit')).toBe(false);
  });

  it('formatGroqGenerateError переводит project block', () => {
    expect(formatGroqGenerateError('llama blocked at the project level')).toMatch(/Groq Console/i);
  });
});
