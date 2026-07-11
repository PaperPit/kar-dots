import { describe, it, expect } from 'vitest';
import { chunksToSegments, cleanSupadataApiKey, mapSupadataError } from '../netlify/functions/lib/supadata.mjs';
import { parseVideoId } from '../netlify/functions/lib/yt-url.mjs';

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
    expect(mapSupadataError({ error: 'unauthorized', message: 'Bad key' })).toEqual({
      code: 'unauthorized',
      message: 'Bad key',
      status: 401,
    });
    expect(mapSupadataError({ error: 'limit-exceeded', message: 'Quota' }).code).toBe('quota');
  });
});

describe('yt-url', () => {
  it('parseVideoId распознаёт ссылки', () => {
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseVideoId('https://example.com')).toBe(null);
  });
});
