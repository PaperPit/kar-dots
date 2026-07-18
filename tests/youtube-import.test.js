import { describe, it, expect } from 'vitest';
import {
  parseYouTubeId, normalizeTerm, stemVariants, isKnownTerm,
  collectKnownTerms, isYoutubeCard, filterNewCandidates,
  filterTranscriptSegments, filterNewSentences,
  fmtTimestamp, buildYtLink, buildCardDescription,
} from '../js/lib/youtube-import.ts';

describe('parseYouTubeId', () => {
  it('понимает все формы ссылок', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/watch?list=PL1&v=dQw4w9WgXcQ&t=1s')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('отклоняет мусор', () => {
    expect(parseYouTubeId('https://vimeo.com/12345')).toBe(null);
    expect(parseYouTubeId('привет')).toBe(null);
    expect(parseYouTubeId('')).toBe(null);
  });
});

describe('normalizeTerm', () => {
  it('чистит регистр, пробелы и крайнюю пунктуацию', () => {
    expect(normalizeTerm('  Cash  Flow ')).toBe('cash flow');
    expect(normalizeTerm('What’s your name?')).toBe("what's your name");
    expect(normalizeTerm('My name is …')).toBe('my name is');
    expect(normalizeTerm('«hello»')).toBe('hello');
  });
});

describe('stemVariants / isKnownTerm', () => {
  it('находит базовые формы', () => {
    expect(stemVariants('walking')).toContain('walk');
    expect(stemVariants('stopped')).toContain('stop');
    expect(stemVariants('studies')).toContain('study');
    expect(stemVariants('studied')).toContain('study');
    expect(stemVariants('loved')).toContain('love');
    expect(stemVariants('boxes')).toContain('box');
    expect(stemVariants('cats')).toContain('cat');
  });
  it('isKnownTerm ловит формы известного слова', () => {
    const known = new Set(['walk', 'study', 'cash flow']);
    expect(isKnownTerm('Walking', known)).toBe(true);
    expect(isKnownTerm('studied', known)).toBe(true);
    expect(isKnownTerm('Cash flow', known)).toBe(true);
    expect(isKnownTerm('mortgage', known)).toBe(false);
  });
  it('фразы сверяются только целиком', () => {
    const known = new Set(['come']);
    expect(isKnownTerm('come up with', known)).toBe(false);
  });
});

describe('collectKnownTerms / isYoutubeCard', () => {
  it('собирает фронты из нескольких списков', () => {
    const known = collectKnownTerms([
      [{ front: 'Hello' }, { front: 'go' }],
      [{ front: 'cash flow' }, { front: '' }, null],
    ]);
    expect(known.has('hello')).toBe(true);
    expect(known.has('cash flow')).toBe(true);
    expect(known.size).toBe(3);
  });
  it('распознаёт YouTube-карточку по таймкод-ссылке', () => {
    expect(isYoutubeCard({ description: 'B1 · гл. · <a href="https://www.youtube.com/watch?v=abc12345678&t=10s">▶ 0:10</a>' })).toBe(true);
    expect(isYoutubeCard({ description: 'A1 · сущ.' })).toBe(false);
    expect(isYoutubeCard({})).toBe(false);
  });
});

describe('filterNewCandidates', () => {
  const mk = (front, kind = 'word', extra = {}) => ({ front, back: 'x', kind, ...extra });

  it('убирает известные слова (в т.ч. по формам) и дубли', () => {
    const known = new Set(['struggle']);
    const { words } = filterNewCandidates(
      [mk('struggling'), mk('mortgage'), mk('Mortgage'), mk('struggle')],
      known,
    );
    expect(words.map(w => w.front)).toEqual(['mortgage']);
  });

  it('фраза приоритетнее слова: слова из фразы не проходят', () => {
    const { phrases, words } = filterNewCandidates(
      [mk('cash flow', 'phrase'), mk('cash'), mk('flow'), mk('mortgage')],
      new Set(),
    );
    expect(phrases.map(p => p.front)).toEqual(['cash flow']);
    expect(words.map(w => w.front)).toEqual(['mortgage']);
  });

  it('известная фраза не предлагается снова', () => {
    const { phrases } = filterNewCandidates([mk('cash flow', 'phrase')], new Set(['cash flow']));
    expect(phrases).toEqual([]);
  });
});

describe('таймкоды и description', () => {
  it('fmtTimestamp', () => {
    expect(fmtTimestamp(0)).toBe('0:00');
    expect(fmtTimestamp(125)).toBe('2:05');
    expect(fmtTimestamp(3723)).toBe('1:02:03');
  });
  it('buildYtLink — с упреждением 2 сек, не уходит в минус', () => {
    expect(buildYtLink('abc12345678', 125.9)).toBe('https://www.youtube.com/watch?v=abc12345678&t=123s');
    expect(buildYtLink('abc12345678', 1)).toBe('https://www.youtube.com/watch?v=abc12345678&t=0s');
  });
  it('description в стиле паков + ссылка (метка честная, ссылка на 2 сек раньше)', () => {
    const d = buildCardDescription({ level: 'B1', pos: 'гл.', kind: 'word', t: 125 }, 'abc12345678');
    expect(d).toBe('B1 · гл. · <a href="https://www.youtube.com/watch?v=abc12345678&t=123s">▶ 2:05</a>');
  });
  it('description фразы и без таймкода', () => {
    expect(buildCardDescription({ level: 'A2', kind: 'phrase', t: null }, 'abc12345678')).toBe('A2 · phrase');
    expect(buildCardDescription({ level: '', pos: 'сущ.', kind: 'word', t: 5 }, ''))
      .toBe('сущ.');
  });
  it('description предложения', () => {
    const d = buildCardDescription({ level: 'B1', kind: 'sentence', t: 30 }, 'abc12345678');
    expect(d).toBe('B1 · sentence · <a href="https://www.youtube.com/watch?v=abc12345678&t=28s">▶ 0:30</a>');
  });
});

describe('filterTranscriptSegments / filterNewSentences', () => {
  it('filterTranscriptSegments отсекает короткие и дубли', () => {
    const out = filterTranscriptSegments([
      { t: 1, text: 'Hi' },
      { t: 2, text: 'Hello world again' },
      { t: 3, text: 'Hello world again' },
    ], { minWords: 3 });
    expect(out).toEqual([{ t: 2, text: 'Hello world again' }]);
  });

  it('filterNewSentences убирает известные', () => {
    const known = new Set(['hello world']);
    const out = filterNewSentences([
      { front: 'Hello world', back: 'x', kind: 'sentence' },
      { front: 'New sentence here', back: 'y', kind: 'sentence' },
    ], known);
    expect(out.map(s => s.front)).toEqual(['New sentence here']);
  });
});
