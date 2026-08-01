import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HOUR_SEC,
  hitRateLimit,
  rateLimitKey,
  retryAfterSec,
  windowStart,
} from '../functions/api/lib/_ratelimit.js';

const SUBJ = 'anon:' + 'a'.repeat(64);

/** Минимальный фейк Workers KV: значения + запомненные опции put. */
function fakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    puts: [],
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, opts) {
      this.puts.push({ key, value, opts });
      store.set(key, value);
    },
  };
}

describe('окно лимита', () => {
  it('windowStart округляет вниз до границы окна', () => {
    expect(windowStart(0, HOUR_SEC)).toBe(0);
    expect(windowStart(3599_000, HOUR_SEC)).toBe(0);
    expect(windowStart(3600_000, HOUR_SEC)).toBe(3600);
    expect(windowStart(3600_000 + 1, HOUR_SEC)).toBe(3600);
    expect(windowStart(7200_000, HOUR_SEC)).toBe(7200);
    expect(windowStart(90_000, 60)).toBe(60);
  });

  it('retryAfterSec — сколько осталось до конца окна', () => {
    expect(retryAfterSec(0, HOUR_SEC)).toBe(HOUR_SEC);
    expect(retryAfterSec(3599_000, HOUR_SEC)).toBe(1);
    expect(retryAfterSec(3600_000, HOUR_SEC)).toBe(HOUR_SEC);
    expect(retryAfterSec(1_000, 60)).toBe(59);
    // никогда не 0 — иначе Retry-After бессмыслен
    expect(retryAfterSec(59_999, 60)).toBeGreaterThanOrEqual(1);
  });

  it('ключ включает scope, субъект и окно', () => {
    expect(rateLimitKey('tts', SUBJ, HOUR_SEC, 3600_000)).toBe(`rl:tts:${SUBJ}:3600`);
    // разные эндпоинты — разные бюджеты
    expect(rateLimitKey('tts', SUBJ, HOUR_SEC, 0)).not.toBe(rateLimitKey('yt-video', SUBJ, HOUR_SEC, 0));
    // новое окно — новый ключ
    expect(rateLimitKey('tts', SUBJ, HOUR_SEC, 0)).not.toBe(rateLimitKey('tts', SUBJ, HOUR_SEC, 3600_000));
  });
});

describe('hitRateLimit', () => {
  let warn;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('считает запросы и упирается в лимит', async () => {
    const kv = fakeKv();
    const opts = { scope: 'tts', subject: SUBJ, limit: 2, now: 0 };
    expect(await hitRateLimit(kv, opts)).toMatchObject({ ok: true, remaining: 1 });
    expect(await hitRateLimit(kv, opts)).toMatchObject({ ok: true, remaining: 0 });
    const third = await hitRateLimit(kv, opts);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBe(HOUR_SEC);
  });

  it('ставит expirationTtl, чтобы счётчики не копились', async () => {
    const kv = fakeKv();
    await hitRateLimit(kv, { scope: 'tts', subject: SUBJ, limit: 5, now: 0 });
    expect(kv.puts[0].opts.expirationTtl).toBe(HOUR_SEC + 60);
  });

  it('новое окно обнуляет счётчик', async () => {
    const kv = fakeKv();
    const base = { scope: 'tts', subject: SUBJ, limit: 1 };
    expect(await hitRateLimit(kv, { ...base, now: 0 })).toMatchObject({ ok: true });
    expect(await hitRateLimit(kv, { ...base, now: 1000 })).toMatchObject({ ok: false });
    expect(await hitRateLimit(kv, { ...base, now: 3600_000 })).toMatchObject({ ok: true });
  });

  it('разные субъекты не мешают друг другу', async () => {
    const kv = fakeKv();
    const other = 'anon:' + 'b'.repeat(64);
    expect(await hitRateLimit(kv, { scope: 'tts', subject: SUBJ, limit: 1, now: 0 })).toMatchObject({ ok: true });
    expect(await hitRateLimit(kv, { scope: 'tts', subject: other, limit: 1, now: 0 })).toMatchObject({ ok: true });
    expect(await hitRateLimit(kv, { scope: 'tts', subject: SUBJ, limit: 1, now: 0 })).toMatchObject({ ok: false });
  });

  it('без биндинга KV пропускает запрос и предупреждает (dev fail open)', async () => {
    const res = await hitRateLimit(null, { scope: 'tts', subject: SUBJ, limit: 1, now: 0 });
    expect(res).toMatchObject({ ok: true, skipped: true });
    expect(warn).toHaveBeenCalled();
  });

  it('без KV + failClosed → отказ (prod)', async () => {
    const res = await hitRateLimit(null, {
      scope: 'tts', subject: SUBJ, limit: 1, now: 0, failClosed: true,
    });
    expect(res).toMatchObject({ ok: false, missingKv: true });
  });

  it('сломанный KV не роняет API (fail open)', async () => {
    const broken = {
      async get() { throw new Error('KV недоступен'); },
      async put() {},
    };
    const res = await hitRateLimit(broken, { scope: 'tts', subject: SUBJ, limit: 1, now: 0 });
    expect(res).toMatchObject({ ok: true, skipped: true });
    expect(warn).toHaveBeenCalled();
  });

  it('сломанный KV + failClosed → отказ', async () => {
    const broken = {
      async get() { throw new Error('KV недоступен'); },
      async put() {},
    };
    const res = await hitRateLimit(broken, {
      scope: 'tts', subject: SUBJ, limit: 1, now: 0, failClosed: true,
    });
    expect(res).toMatchObject({ ok: false, missingKv: true });
  });

  it('ошибка put тоже не роняет запрос', async () => {
    const halfBroken = {
      async get() { return '0'; },
      async put() { throw new Error('KV write failed'); },
    };
    const res = await hitRateLimit(halfBroken, { scope: 'tts', subject: SUBJ, limit: 3, now: 0 });
    expect(res.ok).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});
