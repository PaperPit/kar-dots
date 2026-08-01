// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isStaleModuleError,
  reloadOnceForStaleChunk,
  clearStaleChunkReloadFlag,
} from '../js/lib/stale-chunk.ts';

describe('stale-chunk', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('detects dynamic import fetch failures', () => {
    expect(
      isStaleModuleError(
        new Error(
          'Failed to fetch dynamically imported module: https://example.com/js/home-ABC.js'
        )
      )
    ).toBe(true);
    expect(isStaleModuleError(new Error('NetworkError when attempting to fetch resource.'))).toBe(
      false
    );
  });

  it('reloads once, then surfaces error on second attempt', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });

    expect(
      reloadOnceForStaleChunk(
        new Error('Failed to fetch dynamically imported module: /js/home-x.js')
      )
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('kar_stale_chunk_reload')).toBe('1');

    expect(
      reloadOnceForStaleChunk(
        new Error('Failed to fetch dynamically imported module: /js/home-x.js')
      )
    ).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('kar_stale_chunk_reload')).toBeNull();
  });

  it('clearStaleChunkReloadFlag resets guard', () => {
    sessionStorage.setItem('kar_stale_chunk_reload', '1');
    clearStaleChunkReloadFlag();
    expect(sessionStorage.getItem('kar_stale_chunk_reload')).toBeNull();
  });
});
