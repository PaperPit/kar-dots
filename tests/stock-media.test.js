import { describe, it, expect } from 'vitest';
import {
  normalizeOpenverseHit,
  buildStockSearchUrl,
  hasCyrillic,
  wikimediaThumbUrl,
  pickStockThumb,
  enrichVocabStockQuery,
  rankStockResults,
  scoreStockRelevance,
} from '../js/lib/stock-media.ts';

describe('hasCyrillic', () => {
  it('определяет кириллицу', () => {
    expect(hasCyrillic('воздух')).toBe(true);
    expect(hasCyrillic('air')).toBe(false);
  });
});

describe('wikimediaThumbUrl', () => {
  it('строит thumb для Wikimedia', () => {
    const url = 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Example.jpg';
    expect(wikimediaThumbUrl(url)).toContain('/thumb/b/bd/');
    expect(wikimediaThumbUrl(url)).toContain('320px-Example.jpg');
  });

  it('null для не-wikimedia', () => {
    expect(wikimediaThumbUrl('https://live.staticflickr.com/x.jpg')).toBeNull();
  });
});

describe('pickStockThumb', () => {
  it('предпочитает wikimedia thumb вместо openverse', () => {
    const thumb = pickStockThumb({
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Cat.jpg',
      thumbnail: 'https://api.openverse.org/v1/images/x/thumb/',
    });
    expect(thumb).toContain('upload.wikimedia.org');
    expect(thumb).toContain('/thumb/');
  });
});

describe('normalizeOpenverseHit', () => {
  it('нормализует фото', () => {
    const hit = normalizeOpenverseHit({
      id: 'abc',
      title: ' Apple ',
      url: 'https://example.com/a.jpg',
      thumbnail: 'https://example.com/t.jpg',
      attribution: 'CC BY',
      creator: 'Ann',
    });
    expect(hit).toMatchObject({
      id: 'abc',
      title: 'Apple',
      url: 'https://example.com/a.jpg',
      thumb: 'https://example.com/t.jpg',
      isGif: false,
      attribution: 'CC BY',
      creator: 'Ann',
    });
  });

  it('определяет GIF', () => {
    expect(normalizeOpenverseHit({ url: 'https://x/y.gif', id: '1' }).isGif).toBe(true);
    expect(normalizeOpenverseHit({ url: 'https://x/y.jpg', filetype: 'gif', id: '2' }).isGif).toBe(true);
  });
});

describe('enrichVocabStockQuery', () => {
  it('уточняет month для календаря', () => {
    const r = enrichVocabStockQuery('month');
    expect(r.enriched).toBe(true);
    expect(r.searchQuery).toContain('calendar');
  });

  it('не трогает обычные слова', () => {
    expect(enrichVocabStockQuery('apple').searchQuery).toBe('apple');
  });
});

describe('rankStockResults', () => {
  it('поднимает календарь и опускает heritage month', () => {
    const items = [
      { title: 'Asian American Heritage Month Celebration', source: 'openverse' },
      { title: 'Calendar months of the year', source: 'wikimedia' },
    ];
    const ranked = rankStockResults(items, 'month');
    expect(ranked[0].title).toContain('Calendar');
  });

  it('scoreStockRelevance штрафует шум', () => {
    const bad = scoreStockRelevance({ title: 'Domestic Violence Awareness Month', source: 'openverse' }, 'month');
    const good = scoreStockRelevance({ title: 'Calendar Month View', source: 'openverse' }, 'month');
    expect(good).toBeGreaterThan(bad);
  });
});

describe('buildStockSearchUrl', () => {
  it('добавляет extension=gif для GIF', () => {
    const url = buildStockSearchUrl({ q: 'cat', type: 'gif', page: 2 });
    expect(url).toContain('extension=gif');
    expect(url).toContain('q=cat');
    expect(url).toContain('page=2');
  });
});
