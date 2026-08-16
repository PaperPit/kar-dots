// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  parseReviewRoute,
  buildReviewHash,
  isStudyMode,
  resolveStudyMode,
} from '../js/lib/study-modes.ts';

describe('parseReviewRoute', () => {
  it('defaults for bare review', () => {
    expect(parseReviewRoute(['review'])).toEqual({
      folderId: null, noteId: null, cram: false, mode: 'flip', cramLimit: null,
    });
  });

  it('note-scoped route', () => {
    expect(parseReviewRoute(['review', 'note', 'n1'])).toEqual({
      folderId: null, noteId: 'n1', cram: false, mode: 'flip', cramLimit: null,
    });
  });

  it('note-scoped route with mode', () => {
    expect(parseReviewRoute(['review', 'note', 'n1', 'type'])).toEqual({
      folderId: null, noteId: 'n1', cram: false, mode: 'type', cramLimit: null,
    });
  });

  it('mode-only global review', () => {
    expect(parseReviewRoute(['review', 'voice'])).toEqual({
      folderId: null, noteId: null, cram: false, mode: 'voice', cramLimit: null,
    });
  });

  it('folder with mode', () => {
    expect(parseReviewRoute(['review', 'abc', 'type'])).toEqual({
      folderId: 'abc', noteId: null, cram: false, mode: 'type', cramLimit: null,
    });
  });

  it('global cram without folder', () => {
    expect(parseReviewRoute(['review', 'cram', '20', 'type'])).toEqual({
      folderId: null, noteId: null, cram: true, mode: 'type', cramLimit: 20,
    });
    expect(buildReviewHash(null, { cram: true, cramLimit: 15, mode: 'voice' })).toBe('#review/cram/15/voice');
  });

  it('cram with limit and mode', () => {
    expect(parseReviewRoute(['review', 'abc', 'cram', '20', 'combo'])).toEqual({
      folderId: 'abc', noteId: null, cram: true, mode: 'combo', cramLimit: 20,
    });
  });

  it('cram without explicit mode stays flip', () => {
    expect(parseReviewRoute(['review', 'abc', 'cram', '20'])).toEqual({
      folderId: 'abc', noteId: null, cram: true, mode: 'flip', cramLimit: 20,
    });
  });
});

describe('buildReviewHash', () => {
  it('round-trips folder + cram + limit + mode', () => {
    const hash = buildReviewHash('f1', { cram: true, cramLimit: 15, mode: 'type' });
    expect(hash).toBe('#review/f1/cram/15/type');
    const parts = hash.slice(1).split('/');
    expect(parseReviewRoute(parts)).toEqual({
      folderId: 'f1', noteId: null, cram: true, mode: 'type', cramLimit: 15,
    });
  });

  it('round-trips note-scoped route', () => {
    const hash = buildReviewHash(null, { noteId: 'n42', mode: 'flip' });
    expect(hash).toBe('#review/note/n42');
    const parts = hash.slice(1).split('/');
    expect(parseReviewRoute(parts)).toEqual({
      folderId: null, noteId: 'n42', cram: false, mode: 'flip', cramLimit: null,
    });
  });

  it('round-trips note-scoped route with mode', () => {
    const hash = buildReviewHash(null, { noteId: 'n42', mode: 'voice' });
    expect(hash).toBe('#review/note/n42/voice');
    const parts = hash.slice(1).split('/');
    expect(parseReviewRoute(parts)).toEqual({
      folderId: null, noteId: 'n42', cram: false, mode: 'voice', cramLimit: null,
    });
  });
});

describe('isStudyMode', () => {
  it('accepts known modes only', () => {
    expect(isStudyMode('flip')).toBe(true);
    expect(isStudyMode('match')).toBe(true);
    expect(isStudyMode('cloze')).toBe(true);
    expect(isStudyMode('bogus')).toBe(false);
  });
});

describe('resolveStudyMode', () => {
  it('prefers session override once', () => {
    sessionStorage.setItem('kar_session_study_mode', 'voice');
    expect(resolveStudyMode('flip')).toBe('voice');
    expect(sessionStorage.getItem('kar_session_study_mode')).toBeNull();
  });
});
