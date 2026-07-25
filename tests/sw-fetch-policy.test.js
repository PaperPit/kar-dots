// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderBundleSw, renderUnbundledSw } from '../scripts/lib/sw-precache.mjs';

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

  it('ts-fsrs и иконки папок — runtime, не install precache', () => {
    const sw = readFileSync(join(process.cwd(), 'sw.js'), 'utf8');
    const coreBlock = sw.slice(sw.indexOf('const CORE_FILES'), sw.indexOf('const LAZY_PREFIXES'));
    expect(coreBlock).not.toContain('icons/folders/');
    expect(coreBlock).not.toContain('js/vendor/ts-fsrs.mjs');
    expect(sw).toContain("'js/vendor/ts-fsrs.mjs'");
    expect(sw).toContain("'icons/folders/'");
  });
});

describe('service worker: cache-first / SWR (4.1)', () => {
  const sample = renderBundleSw({ version: 't', coreFiles: ['js/app.js'] });

  it('hashed chunks use cache-first (no forced no-cache)', () => {
    expect(sample).toContain('hashedChunk');
    expect(sample).toContain('[A-Z0-9]{8}');
    expect(sample).not.toContain("cache: 'no-cache'");
  });

  it('shell assets use stale-while-revalidate', () => {
    expect(sample).toContain('shellAsset');
    expect(sample).toContain('return cached || network');
  });

  it('unbundled sw render also drops no-cache', () => {
    const u = renderUnbundledSw({ version: 't', coreFiles: ['./', 'index.html'] });
    expect(u).not.toContain("cache: 'no-cache'");
    expect(u).toContain('hashedChunk');
  });
});
