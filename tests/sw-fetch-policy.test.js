// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Политика из sw.js — 206 ломает Cache API на iOS WebKit. */
function shouldCacheResponse(status, hasRangeHeader) {
  if (hasRangeHeader) return false;
  return status === 200;
}

describe('service worker: ошибка «Response is a 206 partial»', () => {
  it('206 Partial Content нельзя класть в Cache API', () => {
    expect(shouldCacheResponse(206, false)).toBe(false);
  });

  it('запросы с Range не кэшируем (MP3 перед микрофоном)', () => {
    expect(shouldCacheResponse(200, true)).toBe(false);
    expect(shouldCacheResponse(206, true)).toBe(false);
  });

  it('обычный 200 можно кэшировать', () => {
    expect(shouldCacheResponse(200, false)).toBe(true);
  });

  it('sw.js содержит обход Range и проверку status === 200', () => {
    const sw = readFileSync(join(process.cwd(), 'sw.js'), 'utf8');
    expect(sw).toContain("headers.has('range')");
    expect(sw).toContain('resp.status === 200');
    expect(sw).toContain('.catch(() => {})');
  });
});
