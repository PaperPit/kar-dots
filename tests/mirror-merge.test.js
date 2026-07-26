// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import { mergeMirrorRow } from '../js/data/sync-queue.ts';
import { hydrateWithMisses, getCardsByIds } from '../js/data/card-hydrate.ts';
import { StoreCache } from '../js/data/store-cache.ts';

describe('mergeMirrorRow — проекция не должна обеднять зеркало', () => {
  it('keeps fields the projection did not select', () => {
    const existing = {
      id: 'c1', folder_id: 'f', front: 'hi', back: 'привет',
      description: 'длинное описание', front_img: 'u1', back_img: 'u2', sm2_reps: 1,
    };
    const projected = { id: 'c1', folder_id: 'f', front: 'hi', back: 'привет', sm2_reps: 9 };
    const merged = mergeMirrorRow(existing, projected);
    expect(merged.sm2_reps).toBe(9);
    expect(merged.description).toBe('длинное описание');
    expect(merged.front_img).toBe('u1');
    expect(merged.back_img).toBe('u2');
  });

  it('null means "cleared on the server", undefined means "not in the projection"', () => {
    const existing = { id: 'c1', front_img: 'u1', back_img: 'u2' };
    const merged = mergeMirrorRow(existing, { id: 'c1', front_img: null, back_img: undefined });
    expect(merged.front_img).toBeNull();
    expect(merged.back_img).toBe('u2');
  });

  it('returns the incoming row when nothing is stored yet', () => {
    const incoming = { id: 'c1', front: 'hi' };
    expect(mergeMirrorRow(null, incoming)).toBe(incoming);
    expect(mergeMirrorRow(undefined, incoming)).toBe(incoming);
  });

  it('does not mutate the stored row', () => {
    const existing = { id: 'c1', front: 'hi', description: 'd' };
    mergeMirrorRow(existing, { id: 'c1', front: 'bye' });
    expect(existing.front).toBe('hi');
  });
});

describe('mirrorMergeMany / mirrorGetMany', () => {
  let db;
  let sq;

  beforeEach(async () => {
    installFakeIDB({
      cards: [
        { id: 'c1', folder_id: 'f', front: 'hi', back: 'привет', description: 'd1', front_img: 'u1' },
        { id: 'c2', folder_id: 'f', front: 'yo', back: 'йо', description: 'd2', front_img: 'u2' },
      ],
    });
    vi.stubGlobal('navigator', { onLine: true });
    sq = await import('../js/data/sync-queue.ts');
    db = await sq.openMirrorDB();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('mirrorGetMany reads keys in order, undefined for unknown ids', async () => {
    const rows = await sq.mirrorGetMany(db, 'cards', ['c2', 'нет', 'c1']);
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe('c2');
    expect(rows[1]).toBeUndefined();
    expect(rows[2].id).toBe('c1');
    expect(await sq.mirrorGetMany(db, 'cards', [])).toEqual([]);
  });

  it('merges partial rows instead of clobbering full ones', async () => {
    await sq.mirrorMergeMany(db, 'cards', [
      { id: 'c1', folder_id: 'f', front: 'hi', back: 'привет', sm2_reps: 4 },
      { id: 'new', folder_id: 'f', front: 'n', back: 'н' },
    ]);
    const [c1, added] = await sq.mirrorGetMany(db, 'cards', ['c1', 'new']);
    expect(c1.sm2_reps).toBe(4);
    expect(c1.description).toBe('d1');
    expect(c1.front_img).toBe('u1');
    expect(added.front).toBe('n');
    // Соседнюю строку не задели.
    const [c2] = await sq.mirrorGetMany(db, 'cards', ['c2']);
    expect(c2.description).toBe('d2');
  });
});

describe('hydrateWithMisses — пропуски не глотаем', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports ids without a card body', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const byId = new Map([['a', { id: 'a', front: 'A' }]]);
    const { cards, missing } = hydrateWithMisses(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      byId,
    );
    expect(cards.map(c => c.id)).toEqual(['a']);
    expect(missing).toEqual(['b', 'c']);
    expect(console.warn).toHaveBeenCalled();
  });

  it('stays quiet when everything hydrated', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const byId = new Map([['a', { id: 'a' }], ['b', { id: 'b' }]]);
    const { cards, missing } = hydrateWithMisses([{ id: 'a' }, { id: 'b' }], byId);
    expect(cards).toHaveLength(2);
    expect(missing).toEqual([]);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe('getCardsByIds — догрузка из сети', () => {
  let db;

  beforeEach(async () => {
    installFakeIDB({ cards: [{ id: 'mirror', folder_id: 'f', front: 'm' }] });
    vi.stubGlobal('navigator', { onLine: true });
    const sq = await import('../js/data/sync-queue.ts');
    db = await sq.openMirrorDB();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('asks the network only for ids missing from cache and mirror', async () => {
    const cache = new StoreCache();
    cache.folderCache.set('f', [{ id: 'cached', folder_id: 'f', front: 'c' }]);
    const fetchMissing = vi.fn(async (ids) => ids.map(id => ({ id, folder_id: 'f', front: id })));
    const map = await getCardsByIds(db, cache, ['cached', 'mirror', 'remote'], { fetchMissing });
    expect(fetchMissing).toHaveBeenCalledTimes(1);
    expect(fetchMissing.mock.calls[0][0]).toEqual(['remote']);
    expect(map.get('cached').front).toBe('c');
    expect(map.get('mirror').front).toBe('m');
    expect(map.get('remote').front).toBe('remote');
  });

  it('skips the network entirely when nothing is missing', async () => {
    const cache = new StoreCache();
    const fetchMissing = vi.fn(async () => []);
    const map = await getCardsByIds(db, cache, ['mirror'], { fetchMissing });
    expect(fetchMissing).not.toHaveBeenCalled();
    expect(map.size).toBe(1);
  });

  it('leaves cards missing when there is no fetcher (offline)', async () => {
    const map = await getCardsByIds(db, new StoreCache(), ['mirror', 'remote']);
    expect(map.has('mirror')).toBe(true);
    expect(map.has('remote')).toBe(false);
  });
});

describe('SyncQueue.bindPendingUpload — картинка не должна уехать раньше карточки', () => {
  let db;
  let SyncQueue;

  beforeEach(async () => {
    installFakeIDB({});
    vi.stubGlobal('navigator', { onLine: true });
    const sq = await import('../js/data/sync-queue.ts');
    ({ SyncQueue } = sq);
    db = await sq.openMirrorDB();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('attaches cardId and re-queues the upload after the card write', async () => {
    const q = new SyncQueue();
    await q.init(db);
    // Картинку роняют в редактор ДО создания карточки — она первая в очереди.
    await q.enqueue({ op: 'uploadImage', payload: { path: 'p.jpg', side: 'front_img' } });
    await q.enqueue({ op: 'createCard', payload: { row: { id: 'c1' } } });

    expect(await q.bindPendingUpload('front_img', 'c1')).toBe(true);

    const order = [];
    q.onFlush(async (item) => { order.push([item.op, item.payload.cardId]); });
    const r = await q.flush();
    expect(r).toEqual({ ok: 2, fail: 0 });
    expect(order[0][0]).toBe('createCard');
    expect(order[1]).toEqual(['uploadImage', 'c1']);
  });

  it('ignores uploads for another side or already bound ones', async () => {
    const q = new SyncQueue();
    await q.init(db);
    await q.enqueue({ op: 'uploadImage', payload: { path: 'p.jpg', side: 'back_img', cardId: 'old' } });
    expect(await q.bindPendingUpload('front_img', 'c1')).toBe(false);
    expect(await q.bindPendingUpload('back_img', 'c1')).toBe(false);
    expect(await q.bindPendingUpload('', 'c1')).toBe(false);
    expect(await q.bindPendingUpload('front_img', '')).toBe(false);
    expect(await q.size()).toBe(1);
  });
});
