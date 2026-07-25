// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  configureImageUrls,
  clearImageUrlCache,
  parseStorageUrl,
  isSignedFresh,
  resolveImageUrl,
  resolveImageUrlSync,
  resolveImageUrls,
  IMAGE_BUCKET,
  SIGNED_TTL_SEC,
  REFRESH_MARGIN_MS,
} from '../js/data/image-url.ts';

const BASE = 'https://proj.supabase.co';
const PUB = BASE + '/storage/v1/object/public/' + IMAGE_BUCKET + '/user-1/pic.jpg';

function fakeSb(createSignedUrl) {
  return { getBaseUrl: () => BASE, createSignedUrl };
}

describe('parseStorageUrl', () => {
  it('parses only public storage urls of this project', () => {
    expect(parseStorageUrl(PUB, BASE)).toEqual({ bucket: IMAGE_BUCKET, path: 'user-1/pic.jpg' });
    expect(parseStorageUrl(BASE + '/storage/v1/object/public/card-images/a/b/c.png', BASE))
      .toEqual({ bucket: 'card-images', path: 'a/b/c.png' });
  });

  it('leaves foreign and non-http values alone', () => {
    expect(parseStorageUrl('https://other.host/storage/v1/object/public/card-images/a.jpg', BASE)).toBeNull();
    expect(parseStorageUrl('data:image/png;base64,AAA', BASE)).toBeNull();
    expect(parseStorageUrl('blob:https://app/abc', BASE)).toBeNull();
    expect(parseStorageUrl('https://cdn.example.com/pic.jpg', BASE)).toBeNull();
    // Уже подписанная ссылка идёт через /object/sign/ — её не трогаем.
    expect(parseStorageUrl(BASE + '/storage/v1/object/sign/card-images/a.jpg?token=x', BASE)).toBeNull();
    expect(parseStorageUrl('', BASE)).toBeNull();
    expect(parseStorageUrl(null, BASE)).toBeNull();
    // Без известного базового адреса не гадаем.
    expect(parseStorageUrl(PUB, '')).toBeNull();
  });

  it('rejects urls without a bucket/path pair', () => {
    expect(parseStorageUrl(BASE + '/storage/v1/object/public/card-images', BASE)).toBeNull();
    expect(parseStorageUrl(BASE + '/storage/v1/object/public/card-images/', BASE)).toBeNull();
    expect(parseStorageUrl(BASE + '/storage/v1/object/public//a.jpg', BASE)).toBeNull();
  });
});

describe('isSignedFresh', () => {
  const now = 1_000_000;

  it('treats a signature as stale a margin before it actually expires', () => {
    expect(isSignedFresh({ url: 's', expiresAt: now + REFRESH_MARGIN_MS + 1 }, now)).toBe(true);
    expect(isSignedFresh({ url: 's', expiresAt: now + REFRESH_MARGIN_MS }, now)).toBe(false);
    expect(isSignedFresh({ url: 's', expiresAt: now - 1 }, now)).toBe(false);
  });

  it('is false for an empty entry', () => {
    expect(isSignedFresh(null, now)).toBe(false);
    expect(isSignedFresh(undefined, now)).toBe(false);
    expect(isSignedFresh({ url: '', expiresAt: now + 10 * REFRESH_MARGIN_MS }, now)).toBe(false);
  });
});

describe('resolveImageUrl', () => {
  afterEach(() => {
    configureImageUrls(null);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    clearImageUrlCache();
  });

  it('signs a storage url once and serves the cache afterwards', async () => {
    const createSignedUrl = vi.fn(async () => BASE + '/storage/v1/object/sign/x?token=1');
    configureImageUrls(fakeSb(createSignedUrl));
    const first = await resolveImageUrl(PUB);
    const second = await resolveImageUrl(PUB);
    expect(first).toContain('/object/sign/');
    expect(second).toBe(first);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledWith(IMAGE_BUCKET, 'user-1/pic.jpg', SIGNED_TTL_SEC);
  });

  it('re-signs once the cached signature is close to expiry', async () => {
    let n = 0;
    const createSignedUrl = vi.fn(async () => 'signed-' + ++n);
    configureImageUrls(fakeSb(createSignedUrl));
    const start = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(start);
    expect(await resolveImageUrl(PUB)).toBe('signed-1');
    // Ещё в пределах срока — подписи хватает.
    nowSpy.mockReturnValue(start + SIGNED_TTL_SEC * 1000 - REFRESH_MARGIN_MS - 1000);
    expect(await resolveImageUrl(PUB)).toBe('signed-1');
    // Осталось меньше запаса — перевыпуск.
    nowSpy.mockReturnValue(start + SIGNED_TTL_SEC * 1000 - REFRESH_MARGIN_MS);
    expect(await resolveImageUrl(PUB)).toBe('signed-2');
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('does not sign the same path twice concurrently', async () => {
    let release;
    const gate = new Promise(r => { release = r; });
    const createSignedUrl = vi.fn(async () => { await gate; return 'signed'; });
    configureImageUrls(fakeSb(createSignedUrl));
    const both = Promise.all([resolveImageUrl(PUB), resolveImageUrl(PUB)]);
    release();
    expect(await both).toEqual(['signed', 'signed']);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('passes non-storage values through untouched', async () => {
    const createSignedUrl = vi.fn(async () => 'signed');
    configureImageUrls(fakeSb(createSignedUrl));
    expect(await resolveImageUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(await resolveImageUrl('https://cdn.example.com/p.jpg')).toBe('https://cdn.example.com/p.jpg');
    expect(await resolveImageUrl('')).toBe('');
    expect(await resolveImageUrl(null)).toBe('');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('falls back to the stored url when signing fails, without caching the failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const createSignedUrl = vi.fn(async () => { throw new Error('offline'); });
    configureImageUrls(fakeSb(createSignedUrl));
    expect(await resolveImageUrl(PUB)).toBe(PUB);
    expect(await resolveImageUrl(PUB)).toBe(PUB);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('returns the raw url while no client is configured', async () => {
    configureImageUrls(null);
    expect(await resolveImageUrl(PUB)).toBe(PUB);
    expect(resolveImageUrlSync(PUB)).toBe(PUB);
  });

  it('resolveImageUrlSync serves only a cached fresh signature', async () => {
    const createSignedUrl = vi.fn(async () => 'signed');
    configureImageUrls(fakeSb(createSignedUrl));
    expect(resolveImageUrlSync(PUB)).toBe(PUB);
    await resolveImageUrl(PUB);
    expect(resolveImageUrlSync(PUB)).toBe('signed');
    clearImageUrlCache();
    expect(resolveImageUrlSync(PUB)).toBe(PUB);
  });

  it('configureImageUrls drops signatures of the previous session', async () => {
    configureImageUrls(fakeSb(async () => 'signed-a'));
    await resolveImageUrl(PUB);
    expect(resolveImageUrlSync(PUB)).toBe('signed-a');
    configureImageUrls(fakeSb(async () => 'signed-b'));
    expect(resolveImageUrlSync(PUB)).toBe(PUB);
    expect(await resolveImageUrl(PUB)).toBe('signed-b');
  });

  it('resolveImageUrls keeps the order of the input list', async () => {
    configureImageUrls(fakeSb(async (_b, path) => 'signed:' + path));
    const out = await resolveImageUrls([PUB, 'data:x', null]);
    expect(out).toEqual(['signed:user-1/pic.jpg', 'data:x', '']);
    expect(await resolveImageUrls([])).toEqual([]);
  });
});
