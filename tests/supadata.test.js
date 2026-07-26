import { describe, it, expect } from 'vitest';
import { chunksToSegments, cleanSupadataApiKey, mapSupadataError } from '../functions/api/lib/supadata.js';
import { parseVideoId } from '../functions/api/lib/yt-url.js';

describe('supadata lib', () => {
  it('chunksToSegments конвертирует offset в секунды', () => {
    expect(chunksToSegments([
      { text: 'Hello', offset: 1500, duration: 800 },
      { text: '  world  ', offset: 3200, duration: 500 },
    ])).toEqual([
      { t: 2, text: 'Hello' },
      { t: 3, text: 'world' },
    ]);
    expect(chunksToSegments(null)).toEqual([]);
  });

  it('cleanSupadataApiKey принимает разумный формат', () => {
    expect(cleanSupadataApiKey('  sd_abc-123  ')).toBe('sd_abc-123');
    expect(cleanSupadataApiKey('short')).toBe('');
    expect(cleanSupadataApiKey('')).toBe('');
  });

  it('mapSupadataError мапит коды HTTP', () => {
    const mapped = mapSupadataError({ error: 'unauthorized', message: 'Bad key' });
    expect(mapped.code).toBe('unauthorized');
    expect(mapped.status).toBe(401);
    expect(mapSupadataError({ error: 'limit-exceeded', message: 'Quota' }).code).toBe('quota');
    expect(mapSupadataError({ error: 'limit-exceeded' }).status).toBe(429);
  });

  it('mapSupadataError не отражает текст апстрима наружу', () => {
    const mapped = mapSupadataError({
      error: 'unauthorized',
      message: 'key sd_abcdef123456 rejected by upstream node 10.0.0.7',
    });
    // наружу — только наш русский текст
    expect(mapped.message).toBe('Supadata не приняла ключ — проверь его в Настройках');
    expect(mapped.message).not.toContain('sd_abcdef');
    // сырой текст доступен отдельно — только для console.error
    expect(mapped.detail).toContain('sd_abcdef123456');
  });

  it('незнакомый код тоже не протекает текстом апстрима', () => {
    const mapped = mapSupadataError({ error: 'weird-code', message: 'internal stack trace' }, 500);
    expect(mapped.message).toBe('Supadata не смогла обработать запрос');
    expect(mapped.status).toBe(500);
  });
});

describe('yt-url', () => {
  it('parseVideoId распознаёт ссылки', () => {
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseVideoId('https://example.com')).toBe(null);
  });
});
