// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import {
  noteLwwFilter, isMissingNotesTableError, isMissingNoteLinkError, shouldUseNotesDelta,
} from '../js/data/cloud-delta.ts';
import {
  putNoteInMirror, getNoteFromMirror, listNotesFromMirror, makeConflictCopy, replaceNotesMirror,
} from '../js/data/store-notes.ts';
import { openMirrorDB, getAll } from '../js/data/sync-queue.ts';
import { buildNoteRecord } from '../js/data/store-contract.ts';

describe('notes cloud helpers', () => {
  it('noteLwwFilter matches card LWW shape', () => {
    expect(noteLwwFilter('abc', { updated_at: 10 })).toBe('id=eq.abc&updated_at=lt.10');
    expect(noteLwwFilter('abc', {})).toBe('id=eq.abc');
  });

  it('detects missing notes table / note link columns', () => {
    expect(isMissingNotesTableError(new Error('Could not find the table public.notes'))).toBe(true);
    expect(isMissingNoteLinkError(new Error('column cards.note_id does not exist'))).toBe(true);
    expect(isMissingNotesTableError(new Error('column note_id does not exist'))).toBe(false);
  });

  it('shouldUseNotesDelta respects watermark kind', () => {
    const sync = { userId: 'u1', notesAt: 100, notesAtKind: 'synced_at', fullAt: Date.now() };
    expect(shouldUseNotesDelta(sync, 'u1', Date.now(), 'synced_at')).toBe(true);
    expect(shouldUseNotesDelta(sync, 'u1', Date.now(), 'updated_at')).toBe(false);
    expect(shouldUseNotesDelta(sync, 'other', Date.now(), 'synced_at')).toBe(false);
  });
});

describe('notes mirror (SyncQueue v5 stores)', () => {
  /** @type {IDBDatabase} */
  let db;

  beforeEach(async () => {
    installFakeIDB();
    vi.stubGlobal('navigator', { onLine: true });
    db = await openMirrorDB();
  });

  it('creates notes / note_conflicts / note_terms stores', () => {
    expect(db.objectStoreNames.contains('notes')).toBe(true);
    expect(db.objectStoreNames.contains('note_conflicts')).toBe(true);
    expect(db.objectStoreNames.contains('note_terms')).toBe(true);
  });

  it('indexes terms and lists primary notes only', async () => {
    const main = buildNoteRecord({ title: 'Alpha', body: 'beta gamma' });
    await putNoteInMirror(db, main);
    const copy = makeConflictCopy(main.id, { title: 'Alpha', body: 'old' });
    await putNoteInMirror(db, copy);

    const primary = await listNotesFromMirror(db);
    expect(primary.map(n => n.id)).toEqual([main.id]);

    const withConflicts = await listNotesFromMirror(db, { includeConflicts: true });
    expect(withConflicts).toHaveLength(2);

    const found = await listNotesFromMirror(db, { query: 'gamma' });
    expect(found.map(n => n.id)).toEqual([main.id]);

    const conflicts = await getAll(db, 'note_conflicts');
    expect(conflicts.map(c => c.id)).toEqual([copy.id]);
  });

  it('replaceNotesMirror rebuilds FTS', async () => {
    const a = buildNoteRecord({ title: 'One', body: 'apple' });
    const b = buildNoteRecord({ title: 'Two', body: 'banana', conflict_of: a.id });
    await replaceNotesMirror(db, [a, b]);
    expect(await getNoteFromMirror(db, a.id)).toMatchObject({ title: 'One' });
    const terms = await getAll(db, 'note_terms');
    expect(terms.some(t => t.term === 'apple' && t.note_id === a.id)).toBe(true);
    expect(terms.some(t => t.term === 'banana' && t.note_id === b.id)).toBe(true);
  });
});
