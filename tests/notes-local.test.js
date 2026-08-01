// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import { LocalStore } from '../js/data/store-local.ts';
import { exportJSONPayload } from '../js/data/store-contract.ts';

describe('LocalStore notes', () => {
  /** @type {LocalStore} */
  let store;

  beforeEach(async () => {
    installFakeIDB();
    store = new LocalStore();
    await store.init();
  });

  it('creates, updates, searches notes via FTS', async () => {
    const n = await store.createNote({ title: 'Anki tips', body: 'spaced repetition intervals' });
    expect(n.id).toBeTruthy();
    expect(n.conflict_of).toBeNull();

    await store.updateNote(n.id, { body: '# Anki tips\nleitner boxes and sm2' });
    const found = await store.listNotes({ query: 'leitner' });
    expect(found.map(x => x.id)).toContain(n.id);

    const miss = await store.listNotes({ query: 'zzzzmissing' });
    expect(miss).toEqual([]);
  });

  it('stores conflict copies separately', async () => {
    const main = await store.createNote({ title: 'Main', body: 'v1' });
    const copy = await store.createNoteConflictCopy(main.id, { title: 'Main', body: 'loser' });
    expect(copy.conflict_of).toBe(main.id);

    const list = await store.listNotes();
    expect(list.map(x => x.id)).toEqual([main.id]);

    const conflicts = await store.getNoteConflicts(main.id);
    expect(conflicts.map(x => x.id)).toEqual([copy.id]);
  });

  it('links cards to notes and unlinks on note delete', async () => {
    const folder = await store.createFolder({ name: 'F' });
    const card = await store.createCard({ folder_id: folder.id, front: 'hi', back: 'привет' });
    const note = await store.createNote({ title: 'N', body: 'body' });

    await store.linkCardToNote(card.id, note.id, 'intro');
    const linked = await store.getNoteCards(note.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].note_anchor).toBe('intro');

    await store.deleteNote(note.id);
    const cards = await store.getFolderCards(folder.id);
    const again = cards.find(c => c.id === card.id);
    expect(again.note_id).toBeNull();
    expect(again.note_anchor).toBeNull();
    expect(await store.getNote(note.id)).toBeNull();
  });

  it('export/import JSON v3 with notes', async () => {
    const note = await store.createNote({ title: 'Export me', body: 'hello notes' });
    const json = await store.exportJSONFull();
    const data = JSON.parse(json);
    expect(data.v).toBe(3);
    expect(data.notes.some(n => n.id === note.id)).toBe(true);

    installFakeIDB();
    const other = new LocalStore();
    await other.init();
    await other.importJSON(json);
    const imported = await other.getNote(note.id);
    expect(imported?.body).toBe('hello notes');
  });

  it('exportJSONPayload defaults notes to []', () => {
    const raw = exportJSONPayload([], [], {}, []);
    expect(JSON.parse(raw)).toMatchObject({ v: 3, notes: [] });
  });
});
