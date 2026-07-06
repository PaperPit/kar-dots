// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseHash, initRouter } from '../js/core/router.js';
import { parseReviewRoute } from '../js/lib/study-modes.js';

describe('parseHash', () => {
  it('defaults to home', () => {
    expect(parseHash('')).toEqual({ name: 'home', arg: null, parts: ['home'] });
    expect(parseHash('#home')).toEqual({ name: 'home', arg: null, parts: ['home'] });
  });

  it('folder route', () => {
    expect(parseHash('#folder/abc-123')).toEqual({
      name: 'folder', arg: 'abc-123', parts: ['folder', 'abc-123'],
    });
  });

  it('settings route', () => {
    expect(parseHash('#settings')).toEqual({
      name: 'settings', arg: null, parts: ['settings'],
    });
  });

  it('review parts feed parseReviewRoute', () => {
    const { parts } = parseHash('#review/f1/cram/10/type');
    expect(parseReviewRoute(parts)).toEqual({
      folderId: 'f1', cram: true, mode: 'type', cramLimit: 10,
    });
  });
});

describe('initRouter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers hashchange listener', () => {
    const add = vi.spyOn(window, 'addEventListener');
    initRouter();
    expect(add).toHaveBeenCalledWith('hashchange', expect.any(Function));
  });
});
