// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseHash, initRouter } from '../js/core/router.ts';
import { parseReviewRoute } from '../js/lib/study-modes.ts';

describe('parseHash', () => {
  it('defaults to home', () => {
    expect(parseHash('')).toEqual({ name: 'home', arg: null, parts: ['home'], fragment: null });
    expect(parseHash('#home')).toEqual({ name: 'home', arg: null, parts: ['home'], fragment: null });
  });

  it('folder route', () => {
    expect(parseHash('#folder/abc-123')).toEqual({
      name: 'folder', arg: 'abc-123', parts: ['folder', 'abc-123'], fragment: null,
    });
  });

  it('settings route', () => {
    expect(parseHash('#settings')).toEqual({
      name: 'settings', arg: null, parts: ['settings'], fragment: null,
    });
  });

  it('notes routes', () => {
    expect(parseHash('#notes')).toEqual({
      name: 'notes', arg: null, parts: ['notes'], fragment: null,
    });
    expect(parseHash('#note/abc')).toEqual({
      name: 'note', arg: 'abc', parts: ['note', 'abc'], fragment: null,
    });
    expect(parseHash('#note/abc#my-heading')).toEqual({
      name: 'note', arg: 'abc', parts: ['note', 'abc'], fragment: 'my-heading',
    });
    expect(parseHash('#notes/graph')).toEqual({
      name: 'notes', arg: 'graph', parts: ['notes', 'graph'], fragment: null,
    });
    expect(parseHash('#notes/tag/idea')).toEqual({
      name: 'notes', arg: 'tag', parts: ['notes', 'tag', 'idea'], fragment: null,
    });
  });

  it('review parts feed parseReviewRoute', () => {
    const { parts } = parseHash('#review/f1/cram/10/type');
    expect(parseReviewRoute(parts)).toEqual({
      folderId: 'f1', noteId: null, cram: true, mode: 'type', cramLimit: 10,
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
