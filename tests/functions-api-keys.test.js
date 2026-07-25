import { describe, it, expect } from 'vitest';
import {
  cleanGroqApiKey,
  cleanGiphyApiKey,
  cleanPixabayApiKey,
  normalizeOrpheusVoice,
} from '../functions/api/lib/api-keys.js';

describe('functions api-keys', () => {
  it('cleanGroqApiKey принимает длинный ключ и режет мусор', () => {
    expect(cleanGroqApiKey('gsk_' + 'a'.repeat(20))).toMatch(/^gsk_/);
    expect(cleanGroqApiKey('short')).toBe('');
    expect(cleanGroqApiKey('has spaces in key!!!!')).toBe('');
    expect(cleanGroqApiKey('')).toBe('');
  });

  it('normalizeOrpheusVoice падает на hannah', () => {
    expect(normalizeOrpheusVoice('Diana')).toBe('diana');
    expect(normalizeOrpheusVoice('nope')).toBe('hannah');
    expect(normalizeOrpheusVoice('')).toBe('hannah');
  });

  it('cleanPixabayApiKey / cleanGiphyApiKey', () => {
    expect(cleanPixabayApiKey('12345678-abcdefghij')).toBe('12345678-abcdefghij');
    expect(cleanPixabayApiKey('nope')).toBe('');
    expect(cleanGiphyApiKey('a'.repeat(20))).toBe('a'.repeat(20));
    expect(cleanGiphyApiKey('short')).toBe('');
  });
});
