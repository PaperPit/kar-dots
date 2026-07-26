import { describe, it, expect } from 'vitest';
import {
  anonSubject,
  bearerToken,
  clientId,
  clientIp,
  ipBucket,
  isSubject,
  sha256Hex,
  subjectFromRequest,
  userSubject,
} from '../functions/api/lib/_subject.js';
import { bodyTooLarge, endpointLimit, endpointScope } from '../functions/api/_middleware.js';

/** Headers-подобный объект без зависимости от окружения. */
function h(map) {
  return {
    get: (name) => {
      const key = Object.keys(map).find((k) => k.toLowerCase() === String(name).toLowerCase());
      return key === undefined ? null : map[key];
    },
  };
}

describe('clientIp', () => {
  it('берёт CF-Connecting-IP', () => {
    expect(clientIp(h({ 'CF-Connecting-IP': '1.2.3.4' }))).toBe('1.2.3.4');
  });

  it('падает в первый x-forwarded-for, затем в unknown', () => {
    expect(clientIp(h({ 'x-forwarded-for': '5.6.7.8, 9.9.9.9' }))).toBe('5.6.7.8');
    expect(clientIp(h({}))).toBe('unknown');
    expect(clientIp(null)).toBe('unknown');
  });

  it('CF-Connecting-IP приоритетнее подделываемого x-forwarded-for', () => {
    expect(clientIp(h({ 'CF-Connecting-IP': '1.2.3.4', 'x-forwarded-for': '6.6.6.6' }))).toBe('1.2.3.4');
  });
});

describe('clientId', () => {
  it('берёт X-Client-Id как непрозрачную строку', () => {
    expect(clientId(h({ 'X-Client-Id': ' abc ' }))).toBe('abc');
  });

  it('нет заголовка или он огромный → пусто', () => {
    expect(clientId(h({}))).toBe('');
    expect(clientId(h({ 'X-Client-Id': 'x'.repeat(129) }))).toBe('');
    expect(clientId(h({ 'X-Client-Id': 'x'.repeat(128) }))).toBe('x'.repeat(128));
  });
});

describe('bearerToken', () => {
  it('разбирает только схему Bearer', () => {
    expect(bearerToken(h({ Authorization: 'Bearer tok123' }))).toBe('tok123');
    expect(bearerToken(h({ authorization: 'bearer tok123' }))).toBe('tok123');
    expect(bearerToken(h({ Authorization: 'Basic tok123' }))).toBe('');
    expect(bearerToken(h({ Authorization: 'Bearer' }))).toBe('');
    expect(bearerToken(h({}))).toBe('');
  });
});

describe('sha256Hex', () => {
  it('совпадает с эталонным SHA-256', async () => {
    expect(await sha256Hex('1.2.3.4|abc')).toBe(
      '456950c71e5e5be40dbf6ab2fe72cd0179717832fca5350ab566413c4b3626eb',
    );
  });
});

describe('субъект запроса', () => {
  it('проверенный uid → u:<uid>', () => {
    expect(userSubject('11111111-1111-4111-8111-111111111111')).toBe(
      'u:11111111-1111-4111-8111-111111111111',
    );
    expect(userSubject('какой-то мусор с пробелами')).toBe('');
    expect(userSubject('')).toBe('');
  });

  it('аноним — хеш от IP и client id, а не то, что прислал клиент', async () => {
    const s = await anonSubject('1.2.3.4', 'abc');
    expect(s).toBe('anon:456950c71e5e5be40dbf6ab2fe72cd0179717832fca5350ab566413c4b3626eb');
    expect(isSubject(s)).toBe(true);
  });

  it('разные IP или client id дают разные субъекты', async () => {
    const a = await anonSubject('1.2.3.4', 'abc');
    const b = await anonSubject('1.2.3.5', 'abc');
    const c = await anonSubject('1.2.3.4', 'abd');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    // и стабильны при повторе
    expect(await anonSubject('1.2.3.4', 'abc')).toBe(a);
  });

  it('нет X-Client-Id — субъект всё равно выводится из IP', async () => {
    expect(await anonSubject('1.2.3.4', '')).toBe(
      'anon:cc00d473d40c0e94cc913fe288aa8b23f3d79f4605828ba40ceadf52b3357a4e',
    );
  });

  it('subjectFromRequest считает то же самое, что и middleware', async () => {
    const req = { headers: h({ 'CF-Connecting-IP': '1.2.3.4', 'X-Client-Id': 'abc' }) };
    expect(await subjectFromRequest(req)).toBe(await anonSubject('1.2.3.4', 'abc'));
  });

  it('ipBucket не хранит сырой IP', async () => {
    const bucket = await ipBucket('1.2.3.4');
    expect(bucket.startsWith('ip:')).toBe(true);
    expect(bucket).not.toContain('1.2.3.4');
    expect(bucket).toBe(await ipBucket('1.2.3.4'));
  });
});

describe('middleware: маршруты и размер тела', () => {
  it('endpointScope берёт последний сегмент пути', () => {
    expect(endpointScope('/api/yt-video')).toBe('yt-video');
    expect(endpointScope('/api/stock-search')).toBe('stock-search');
    expect(endpointScope('/api/')).toBe('api');
    expect(endpointScope('/api/../../etc/passwd')).toBe('passwd');
  });

  it('у каждого эндпоинта свой часовой бюджет', () => {
    expect(endpointLimit('yt-video')).toBe(20);
    expect(endpointLimit('yt-generate')).toBe(20);
    expect(endpointLimit('tts')).toBe(40);
    expect(endpointLimit('stock-search')).toBe(120);
    expect(endpointLimit('что-то-новое')).toBe(60);
  });

  it('bodyTooLarge смотрит на Content-Length', () => {
    expect(bodyTooLarge(String(256 * 1024))).toBe(false);
    expect(bodyTooLarge(String(256 * 1024 + 1))).toBe(true);
    expect(bodyTooLarge(null)).toBe(false);
    expect(bodyTooLarge('не число')).toBe(false);
    expect(bodyTooLarge('100', 50)).toBe(true);
  });
});
