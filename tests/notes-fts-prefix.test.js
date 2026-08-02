// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import { matchPrefixTerms } from '../js/lib/notes-fts.ts';
import { putNoteInMirror, searchNoteIdsInMirror } from '../js/data/store-notes.ts';
import { openMirrorDB } from '../js/data/sync-queue.ts';
import { buildNoteRecord } from '../js/data/store-contract.ts';

describe('notes FTS prefix search', () => {
  it('matches known terms by prefix', () => {
    expect(matchPrefixTerms(['Alpha', 'alphabet', 'beta', 'Alpha'], 'alp')).toEqual([
      'alpha',
      'alphabet',
    ]);
  });

  it('searches mirror note terms by prefix range', async () => {
    installFakeIDB();
    const db = await openMirrorDB();
    const alpha = buildNoteRecord({ title: 'Alpha', body: 'first' });
    const alpine = buildNoteRecord({ title: 'Trip', body: 'alpine route' });
    const beta = buildNoteRecord({ title: 'Beta', body: 'second' });

    await putNoteInMirror(db, alpha);
    await putNoteInMirror(db, alpine);
    await putNoteInMirror(db, beta);

    const ids = await searchNoteIdsInMirror(db, 'alp');
    expect(new Set(ids)).toEqual(new Set([alpha.id, alpine.id]));
  });
});
