import { describe, it, expect } from 'vitest';
import { parseVideoId, isVideoId, buildWatchUrl } from '../functions/api/lib/yt-url.js';

const ID = 'dQw4w9WgXcQ';

describe('parseVideoId — валидные ссылки', () => {
  it('принимает голый id и youtu.be', () => {
    expect(parseVideoId(ID)).toBe(ID);
    expect(parseVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseVideoId(`https://youtu.be/${ID}?t=10`)).toBe(ID);
  });

  it('принимает watch/shorts/embed/live', () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseVideoId(`https://www.youtube.com/watch?feature=share&v=${ID}&t=5`)).toBe(ID);
    expect(parseVideoId(`https://m.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseVideoId(`youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseVideoId(`https://www.youtube.com/live/${ID}?si=1`)).toBe(ID);
    expect(parseVideoId(`  https://youtu.be/${ID}  `)).toBe(ID);
  });
});

describe('parseVideoId — SSRF второго порядка', () => {
  it('не даёт протащить чужой хост', () => {
    // без якорей эти строки проходили проверку, а дальше в апстрим
    // пересылался сырой url вызывающего
    expect(parseVideoId(`https://evil.example/?next=https://youtu.be/${ID}`)).toBe(null);
    expect(parseVideoId(`https://youtu.be.evil.example/${ID}`)).toBe(null);
    expect(parseVideoId(`http://169.254.169.254/latest#https://youtu.be/${ID}`)).toBe(null);
    expect(parseVideoId(`https://evil.example/youtube.com/watch?v=${ID}`)).toBe(null);
    expect(parseVideoId(`file:///etc/passwd#youtu.be/${ID}`)).toBe(null);
  });

  it('отвергает мусор и id неправильной длины', () => {
    expect(parseVideoId('https://example.com')).toBe(null);
    expect(parseVideoId('')).toBe(null);
    expect(parseVideoId(null)).toBe(null);
    expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBe(null);
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}TOOLONG`)).toBe(null);
    expect(parseVideoId('../../etc/passwd')).toBe(null);
  });
});

describe('isVideoId / buildWatchUrl', () => {
  it('id — ровно 11 символов из [A-Za-z0-9_-]', () => {
    expect(isVideoId(ID)).toBe(true);
    expect(isVideoId('short')).toBe(false);
    expect(isVideoId('12345678901.')).toBe(false);
    expect(isVideoId('слово11сим1')).toBe(false);
  });

  it('в апстрим уходит только собранный нами url', () => {
    expect(buildWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(() => buildWatchUrl('https://evil.example')).toThrow();
    expect(() => buildWatchUrl('')).toThrow();
  });
});
