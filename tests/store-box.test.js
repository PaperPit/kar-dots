// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import { foldersInBox, looseFolders, boxFolderStats } from '../js/data/store-box.js';

const folderA = { id: 'fa', name: 'A', color: '#000', created_at: 1, box_id: null };
const folderB = { id: 'fb', name: 'B', color: '#111', created_at: 2, box_id: 'bx1' };
const folderC = { id: 'fc', name: 'C', color: '#222', created_at: 3, box_id: 'bx1' };
const box1 = { id: 'bx1', name: 'English', color: '#8F3D18', created_at: 1 };

describe('store-box helpers', () => {
  it('foldersInBox and looseFolders', () => {
    const folders = [folderA, folderB, folderC];
    expect(foldersInBox(folders, 'bx1').map(f => f.id)).toEqual(['fb', 'fc']);
    expect(looseFolders(folders).map(f => f.id)).toEqual(['fa']);
  });
});

describe('LocalStore boxes', () => {
  let LocalStore;
  let store;

  beforeEach(async () => {
    installFakeIDB({
      folders: [folderA, folderB, folderC],
      boxes: [box1],
      cards: [
        { id: 'c1', folder_id: 'fb', front: 'a', back: 'b', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1 },
        { id: 'c2', folder_id: 'fc', front: 'c', back: 'd', sm2_reps: 0, sm2_due: null, box: 0, created_at: 2 },
      ],
    });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
    });
    ({ LocalStore } = await import('../js/data/store-local.js'));
    store = new LocalStore();
    await store.init();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads boxes on init', () => {
    expect(store.boxes).toHaveLength(1);
    expect(store.boxes[0].name).toBe('English');
  });

  it('createBox and setBoxFolders', async () => {
    const box = await store.createBox({ name: 'Topics', color: '#C45528', icon: 'globe' });
    expect(box.icon).toBe('globe');
    await store.setBoxFolders(box.id, ['fa']);
    expect(store.folders.find(f => f.id === 'fa').box_id).toBe(box.id);
    expect(looseFolders(store.folders)).toHaveLength(0);
  });

  it('deleteBox releases folders', async () => {
    await store.deleteBox('bx1');
    expect(store.boxes).toHaveLength(0);
    expect(store.folders.every(f => !f.box_id)).toBe(true);
  });

  it('boxFolderStats aggregates cards', async () => {
    const stats = await boxFolderStats(store, 'bx1', 20);
    expect(stats.folders).toBe(2);
    expect(stats.cards).toBe(2);
  });
});
