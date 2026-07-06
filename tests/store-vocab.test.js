import { describe, it, expect, vi } from 'vitest';
import { findFolderByPackId, importVocabPack, deleteVocabPack } from '../js/data/store-vocab.js';

function mockStore() {
  const folders = [];
  const cards = [];
  let folderSeq = 0;
  let cardSeq = 0;
  return {
    folders,
    cards,
    async createFolder(data) {
      const folder = { id: `f${++folderSeq}`, ...data };
      folders.push(folder);
      return folder;
    },
    async createCard(data) {
      const card = { id: `c${++cardSeq}`, ...data };
      cards.push(card);
      return card;
    },
    async deleteFolder(id) {
      const i = folders.findIndex(f => f.id === id);
      if (i >= 0) folders.splice(i, 1);
    },
  };
}

describe('store-vocab', () => {
  it('findFolderByPackId returns matching folder', () => {
    const folders = [{ id: 'a', pack_id: 'en-a1' }, { id: 'b' }];
    expect(findFolderByPackId(folders, 'en-a1')?.id).toBe('a');
    expect(findFolderByPackId(folders, 'missing')).toBeNull();
  });

  it('importVocabPack creates folder and cards', async () => {
    const store = mockStore();
    const onProgress = vi.fn();
    const pack = {
      id: 'test-pack',
      title: 'Test Pack',
      color: '#123456',
      version: 2,
      cards: [
        { front: 'hello', back: 'привет' },
        { front: '  ', back: 'skip' },
        { front: 'bye', back: 'пока', description: 'farewell' },
      ],
    };
    const folder = await importVocabPack(store, pack, onProgress);
    expect(folder.name).toBe('Test Pack');
    expect(folder.pack_id).toBe('test-pack');
    expect(folder.pack_version).toBe(2);
    expect(folder.icon).toBe('graduation-cap');
    expect(store.cards).toHaveLength(2);
    expect(store.cards[0].folder_id).toBe(folder.id);
    expect(onProgress).toHaveBeenCalledWith({ phase: 'import', done: 2, total: 2 });
  });

  it('importVocabPack rejects duplicate pack', async () => {
    const store = mockStore();
    store.folders.push({ id: 'x', pack_id: 'dup' });
    await expect(importVocabPack(store, { id: 'dup', cards: [{ front: 'a' }] }))
      .rejects.toThrow('уже установлен');
  });

  it('importVocabPack rejects invalid pack', async () => {
    const store = mockStore();
    await expect(importVocabPack(store, null)).rejects.toThrow('Неверный формат');
    await expect(importVocabPack(store, { id: 'x' })).rejects.toThrow('Неверный формат');
  });

  it('deleteVocabPack removes folder by pack id', async () => {
    const store = mockStore();
    store.folders.push({ id: 'f1', pack_id: 'rm-me' });
    await deleteVocabPack(store, 'rm-me');
    expect(store.folders).toHaveLength(0);
  });

  it('deleteVocabPack errors when pack missing', async () => {
    const store = mockStore();
    await expect(deleteVocabPack(store, 'nope')).rejects.toThrow('не установлен');
  });
});
