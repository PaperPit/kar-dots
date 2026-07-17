import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTranscriptCacheFresh, CACHE_TTL_MS } from '../js/data/yt-transcript-cache.js';
import { createYoutubeCardsBatch, prepareTranscriptForMode } from '../js/lib/yt-transcript.js';

describe('isTranscriptCacheFresh', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-01T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('свежий кэш в пределах TTL', () => {
    const fetchedAt = Date.now() - CACHE_TTL_MS + 1000;
    expect(isTranscriptCacheFresh(fetchedAt)).toBe(true);
  });

  it('просроченный кэш', () => {
    const fetchedAt = Date.now() - CACHE_TTL_MS - 1;
    expect(isTranscriptCacheFresh(fetchedAt)).toBe(false);
  });
});

describe('prepareTranscriptForMode', () => {
  it('для sentences склеивает и фильтрует', () => {
    const out = prepareTranscriptForMode({
      lang: 'en',
      segments: [
        { t: 1, text: 'Hi' },
        { t: 2, text: 'there friend.' },
        { t: 10, text: 'Ok' },
      ],
    }, 'sentences', { mergeCues: true });
    expect(out.segments.length).toBe(1);
    expect(out.segments[0].text).toBe('Hi there friend.');
  });

  it('для words не меняет сегменты', () => {
    const transcript = { segments: [{ t: 1, text: 'Hi' }] };
    expect(prepareTranscriptForMode(transcript, 'words')).toBe(transcript);
  });
});

describe('createYoutubeCardsBatch', () => {
  it('частичный успех — не падает на ошибке', async () => {
    const createCard = vi.fn()
      .mockResolvedValueOnce({ id: '1' })
      .mockRejectedValueOnce(new Error('dup'))
      .mockResolvedValueOnce({ id: '3' });

    const selected = [
      { cand: { front: 'a', kind: 'word', t: 1 }, back: 'A' },
      { cand: { front: 'b', kind: 'word', t: 2 }, back: 'B' },
      { cand: { front: 'c', kind: 'word', t: 3 }, back: 'C' },
    ];

    const { ok, failed } = await createYoutubeCardsBatch(createCard, 'f1', selected, 'vid12345678');
    expect(ok).toBe(2);
    expect(failed).toEqual([{ front: 'b', message: 'dup' }]);
    expect(createCard).toHaveBeenCalledTimes(3);
  });

  it('пропускает пустой перевод', async () => {
    const createCard = vi.fn().mockResolvedValue({ id: '1' });
    const { ok, failed } = await createYoutubeCardsBatch(createCard, 'f1', [
      { cand: { front: 'a', kind: 'word' }, back: '   ' },
      { cand: { front: 'b', kind: 'word' }, back: 'B' },
    ], null);
    expect(ok).toBe(1);
    expect(failed).toEqual([]);
    expect(createCard).toHaveBeenCalledTimes(1);
  });
});
