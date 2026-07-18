// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import { DEFAULT_SETTINGS } from '../js/data/store-common.ts';

const now = 1_700_000_000_000;
const folderA = { id: 'fa', name: 'A', color: '#000', created_at: 1 };
const folderB = { id: 'fb', name: 'B', color: '#111', created_at: 2 };

const srsMeta = [
  { id: 'n1', folder_id: 'fa', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1 },
  { id: 'd1', folder_id: 'fa', sm2_reps: 2, sm2_due: now - 60_000, box: 1, box_due: now - 60_000, created_at: 2 },
  { id: 'f1', folder_id: 'fa', sm2_reps: 2, sm2_due: now + 86_400_000, box: 2, box_due: now + 86_400_000, created_at: 3 },
  { id: 'tm', folder_id: 'fa', sm2_reps: 1, sm2_due: now + 3_600_000, box: 1, box_due: now + 3_600_000, created_at: 4 },
  { id: 'n2', folder_id: 'fb', sm2_reps: 0, sm2_due: null, box: 0, created_at: 5 },
  { id: 'd2', folder_id: 'fb', sm2_reps: 1, sm2_due: now - 1_000, box: 1, box_due: now - 1_000, created_at: 6 },
];

describe('CloudStore SRS counts (mirror / offline)', () => {
  let CloudStore;
  let store;

  beforeEach(async () => {
    installFakeIDB({
      folders: [folderA, folderB],
      cards: srsMeta.map(m => ({ ...m, front: 'w', back: 'd', description: '' })),
      kv: {
        settings: DEFAULT_SETTINGS,
        srs_meta: srsMeta,
      },
    });
    vi.stubGlobal('navigator', { onLine: false, addEventListener: vi.fn() });
    vi.stubGlobal('Date', class extends Date {
      constructor(...args) {
        if (args.length === 0) return new Date(now);
        return new Date(...args);
      }
      static now() { return now; }
    });
    ({ CloudStore } = await import('../js/data/store-cloud.ts'));
    store = new CloudStore({ userId: () => 'user-1' });
    await store.init();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads srs_meta from mirror when offline', () => {
    expect(store.offline).toBe(true);
    expect(store._srsMeta).toHaveLength(6);
  });

  it('countDue all folders (sm2) from memory', async () => {
    expect(await store.countDue(null, 'sm2')).toBe(2);
  });

  it('countDue single folder', async () => {
    expect(await store.countDue('fa', 'sm2')).toBe(1);
    expect(await store.countDue('fb', 'sm2')).toBe(1);
  });

  it('countNew from srs_meta', async () => {
    expect(await store.countNew(null, 'sm2')).toBe(2);
    expect(await store.countNew('fa', 'sm2')).toBe(1);
  });

  it('countDueBetween from srs_meta', async () => {
    const from = now;
    const to = now + 7_200_000;
    expect(await store.countDueBetween(null, 'sm2', from, to)).toBe(1);
  });

  it('countCards from cached counts', async () => {
    expect(await store.countCards('fa')).toBe(4);
    expect(await store.countCards(null)).toBe(6);
  });

  it('getReviewCards offline uses srs_meta for all folders', async () => {
    const { due, fresh } = await store.getReviewCards(null, 'sm2', 5, now);
    expect(due.length).toBe(2);
    expect(fresh.length).toBe(2);
    expect(due[0].front).toBe('w');
  });

  it('createCard updates srs_meta and counts without network', async () => {
    const row = await store.createCard({
      folder_id: 'fa', front: 'x', back: 'y', description: '',
    });
    expect(store._srsMeta.some(c => c.id === row.id)).toBe(true);
    expect(await store.countNew('fa', 'sm2')).toBe(2);
    expect(await store.countCards('fa')).toBe(5);
    expect(await store.pendingSync()).toBeGreaterThan(0);
  });

  it('updateCard patches srs_meta (grade simulation)', async () => {
    await store.updateCard('d1', { sm2_reps: 3, sm2_due: now + 86_400_000 });
    const meta = store._srsMeta.find(c => c.id === 'd1');
    expect(meta.sm2_reps).toBe(3);
    expect(await store.countDue('fa', 'sm2')).toBe(0);
  });
});

describe('CloudStore online fetch', () => {
  it('countCards after _fetchFromCloud uses srs_meta per folder', async () => {
    const cloudSrsMeta = [
      { id: 'n1', folder_id: 'fa', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1, updated_at: 1 },
      { id: 'd1', folder_id: 'fa', sm2_reps: 2, sm2_due: now - 60_000, box: 1, box_due: now - 60_000, created_at: 2, updated_at: 2 },
      { id: 'f1', folder_id: 'fa', sm2_reps: 2, sm2_due: now + 86_400_000, box: 2, box_due: now + 86_400_000, created_at: 3, updated_at: 3 },
      { id: 'tm', folder_id: 'fa', sm2_reps: 1, sm2_due: now + 3_600_000, box: 1, box_due: now + 3_600_000, created_at: 4, updated_at: 4 },
      { id: 'n2', folder_id: 'fb', sm2_reps: 0, sm2_due: null, box: 0, created_at: 5, updated_at: 5 },
      { id: 'd2', folder_id: 'fb', sm2_reps: 1, sm2_due: now - 1_000, box: 1, box_due: now - 1_000, created_at: 6, updated_at: 6 },
    ];
    installFakeIDB({ folders: [], cards: [], kv: {} });
    vi.stubGlobal('navigator', { onLine: true, addEventListener: vi.fn() });
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const sb = {
      userId: () => 'user-1',
      select: vi.fn(async (table, query) => {
        if (table === 'folders') return [folderA, folderB];
        if (table === 'cards' && query.includes('select=')) return cloudSrsMeta;
        if (table === 'settings') return [{ data: DEFAULT_SETTINGS }];
        return [];
      }),
      count: vi.fn(async () => cloudSrsMeta.length),
    };
    const store = new CloudStore(sb);
    store.mirror = await (await import('../js/data/sync-queue.ts')).openMirrorDB();
    await store._fetchFromCloud();
    expect(await store.countCards('fa')).toBe(4);
    expect(await store.countCards('fb')).toBe(2);
    expect(await store.countCards(null)).toBe(6);
    const { mirrorGetKV } = await import('../js/data/sync-queue.ts');
    const { CLOUD_SYNC_KEY } = await import('../js/data/cloud-delta.ts');
    const sync = await mirrorGetKV(store.mirror, CLOUD_SYNC_KEY);
    expect(sync.userId).toBe('user-1');
    expect(sync.cardsAt).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it('second fetch uses cards delta (updated_at=gt) when watermark is fresh', async () => {
    const baseMeta = [
      { id: 'n1', folder_id: 'fa', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1, updated_at: 10 },
      { id: 'd1', folder_id: 'fa', sm2_reps: 2, sm2_due: now - 1, box: 1, box_due: now - 1, created_at: 2, updated_at: 20 },
    ];
    const { CLOUD_SYNC_KEY } = await import('../js/data/cloud-delta.ts');
    installFakeIDB({
      folders: [folderA],
      cards: [],
      kv: {
        settings: DEFAULT_SETTINGS,
        srs_meta: baseMeta,
        [CLOUD_SYNC_KEY]: { userId: 'user-1', cardsAt: 50, fullAt: Date.now() },
      },
    });
    vi.stubGlobal('navigator', { onLine: true, addEventListener: vi.fn() });
    const deltaRow = {
      id: 'd1', folder_id: 'fa', sm2_reps: 9, sm2_due: now + 1000,
      box: 2, box_due: now + 1000, created_at: 2, updated_at: 90,
    };
    const select = vi.fn(async (table, query) => {
      if (table === 'folders') return [folderA];
      if (table === 'settings') return [{ data: DEFAULT_SETTINGS }];
      if (table === 'boxes') return [];
      if (table === 'cards') {
        if (query.includes('updated_at=gt.')) return [deltaRow];
        return baseMeta; // full fallback should not be hit
      }
      return [];
    });
    const count = vi.fn(async () => 2);
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const store = new CloudStore({ userId: () => 'user-1', select, count });
    store.mirror = await (await import('../js/data/sync-queue.ts')).openMirrorDB();
    store._srsMeta = baseMeta.slice();
    await store._fetchFromCloud();
    expect(store._srsMeta.find(c => c.id === 'd1').sm2_reps).toBe(9);
    expect(store._srsMeta).toHaveLength(2);
    const deltaCalls = select.mock.calls.filter(([t, q]) => t === 'cards' && String(q).includes('updated_at=gt.'));
    expect(deltaCalls.length).toBe(1);
    const fullCalls = select.mock.calls.filter(([t, q]) => t === 'cards' && !String(q).includes('updated_at=gt.'));
    expect(fullCalls.length).toBe(0);
    vi.unstubAllGlobals();
  });

  it('delta falls back to full when remote count mismatches (delete)', async () => {
    const baseMeta = [
      { id: 'n1', folder_id: 'fa', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1, updated_at: 10 },
      { id: 'gone', folder_id: 'fa', sm2_reps: 1, sm2_due: null, box: 0, created_at: 2, updated_at: 20 },
    ];
    const remaining = [
      { id: 'n1', folder_id: 'fa', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1, updated_at: 10 },
    ];
    const { CLOUD_SYNC_KEY } = await import('../js/data/cloud-delta.ts');
    installFakeIDB({
      folders: [folderA],
      cards: [],
      kv: {
        settings: DEFAULT_SETTINGS,
        srs_meta: baseMeta,
        [CLOUD_SYNC_KEY]: { userId: 'user-1', cardsAt: 50, fullAt: Date.now() },
      },
    });
    vi.stubGlobal('navigator', { onLine: true, addEventListener: vi.fn() });
    const select = vi.fn(async (table, query) => {
      if (table === 'folders') return [folderA];
      if (table === 'settings') return [{ data: DEFAULT_SETTINGS }];
      if (table === 'boxes') return [];
      if (table === 'cards') {
        if (query.includes('updated_at=gt.')) return [];
        return remaining;
      }
      return [];
    });
    const count = vi.fn(async () => 1);
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const store = new CloudStore({ userId: () => 'user-1', select, count });
    store.mirror = await (await import('../js/data/sync-queue.ts')).openMirrorDB();
    store._srsMeta = baseMeta.slice();
    await store._fetchFromCloud();
    expect(store._srsMeta).toHaveLength(1);
    expect(store._srsMeta[0].id).toBe('n1');
    expect(select.mock.calls.some(([, q]) => String(q).includes('updated_at=gt.'))).toBe(true);
    expect(select.mock.calls.some(([t, q]) => t === 'cards' && !String(q).includes('updated_at=gt.'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('createBox succeeds locally when boxes table is missing in Supabase', async () => {
    installFakeIDB({ folders: [folderA, folderB], cards: [], kv: {} });
    vi.stubGlobal('navigator', { onLine: true, addEventListener: vi.fn() });
    const schemaErr = new Error("Could not find the table 'public.boxes' in the schema cache");
    const sb = {
      userId: () => 'user-1',
      insert: vi.fn(async (table) => {
        if (table === 'boxes') throw schemaErr;
      }),
      select: vi.fn(async () => []),
      update: vi.fn(async () => true),
      remove: vi.fn(async () => true),
    };
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const store = new CloudStore(sb);
    store.mirror = await (await import('../js/data/sync-queue.ts')).openMirrorDB();
    await store._loadCloudFlags();
    const box = await store.createBox({ name: 'English', color: '#C45528' });
    expect(box.name).toBe('English');
    expect(store.boxes).toHaveLength(1);
    expect(store._boxesCloudUnsupported).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('CloudStore _patchSrsMetaRemoval', () => {
  it('decrements counts after deleteCard queued offline', async () => {
    installFakeIDB({
      folders: [folderA],
      cards: [{ id: 'n1', folder_id: 'fa', front: 'a', back: 'b', description: '', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1 }],
      kv: { settings: DEFAULT_SETTINGS, srs_meta: [srsMeta[0]] },
    });
    vi.stubGlobal('navigator', { onLine: false, addEventListener: vi.fn() });
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const store = new CloudStore({ userId: () => 'u1' });
    await store.init();
    await store.deleteCard('n1');
    expect(await store.countCards('fa')).toBe(0);
    expect(await store.countNew('fa', 'sm2')).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe('CloudStore online review + optimistic updateCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getReviewCards online uses REVIEW_CARD_FIELDS (not select=*)', async () => {
    const { REVIEW_CARD_FIELDS } = await import('../js/data/srs-meta.ts');
    installFakeIDB({
      folders: [folderA],
      cards: [],
      kv: { settings: DEFAULT_SETTINGS, srs_meta: [] },
    });
    vi.stubGlobal('navigator', { onLine: true, addEventListener: vi.fn() });
    const dueCard = {
      id: 'd1', folder_id: 'fa', front: 'hi', back: 'привет', description: '',
      front_img: null, back_img: null, sm2_reps: 2, sm2_due: now - 1, box: 1, box_due: now - 1, created_at: 1,
    };
    const select = vi.fn(async (_table, query) => {
      if (query.includes('sm2_due=lte')) return [dueCard];
      if (query.includes('sm2_reps=eq.0')) return [];
      return [];
    });
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const store = new CloudStore({ userId: () => 'user-1', select });
    store.mirror = await (await import('../js/data/sync-queue.ts')).openMirrorDB();
    store._offline = false;
    store.settings = { ...DEFAULT_SETTINGS };
    const { due } = await store.getReviewCards('fa', 'sm2', 5, now);
    expect(due).toHaveLength(1);
    expect(due[0].front).toBe('hi');
    expect(select).toHaveBeenCalled();
    for (const call of select.mock.calls) {
      const q = call[1];
      expect(q).toContain('select=' + REVIEW_CARD_FIELDS);
      expect(q).not.toMatch(/select=\*/);
    }
  });

  it('updateCard online returns before cloud PATCH finishes', async () => {
    const card = {
      id: 'd1', folder_id: 'fa', front: 'w', back: 'd', description: '',
      sm2_reps: 2, sm2_due: now - 1, box: 1, box_due: now - 1, created_at: 1,
    };
    installFakeIDB({
      folders: [folderA],
      cards: [card],
      kv: { settings: DEFAULT_SETTINGS, srs_meta: [srsMeta[1]] },
    });
    vi.stubGlobal('navigator', { onLine: true, addEventListener: vi.fn() });
    let release;
    const gate = new Promise(r => { release = r; });
    let cloudDone = false;
    const update = vi.fn(async () => {
      await gate;
      cloudDone = true;
      return true;
    });
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const { openMirrorDB } = await import('../js/data/sync-queue.ts');
    const store = new CloudStore({
      userId: () => 'user-1',
      update,
      insert: vi.fn(),
      remove: vi.fn(),
    });
    store.mirror = await openMirrorDB();
    await store.queue.init(store.mirror);
    store.queue.onFlush(item => store._executeSyncItem(item));
    store.folders = [folderA];
    store._srsMeta = [{ ...srsMeta[1] }];
    store._offline = false;
    store.settings = { ...DEFAULT_SETTINGS };

    const result = await store.updateCard('d1', { sm2_reps: 3, sm2_due: now + 86_400_000 });
    expect(result.sm2_reps).toBe(3);
    expect(cloudDone).toBe(false);
    release();
    await store._bgSyncTail;
    expect(cloudDone).toBe(true);
    expect(update).toHaveBeenCalledWith('cards', 'id=eq.d1', expect.objectContaining({ sm2_reps: 3 }));
  });
});

describe('CloudStore deleteFolder + srs_meta debounce', () => {
  it('deleteFolder removes all folder cards in one mirror batch', async () => {
    installFakeIDB({
      folders: [folderA, folderB],
      cards: srsMeta.map(m => ({ ...m, front: 'w', back: 'd', description: '' })),
      kv: { settings: DEFAULT_SETTINGS, srs_meta: srsMeta },
    });
    vi.stubGlobal('navigator', { onLine: false, addEventListener: vi.fn() });
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const { mirrorGetKV } = await import('../js/data/sync-queue.ts');
    const store = new CloudStore({ userId: () => 'u1' });
    await store.init();
    await store.deleteFolder('fa');
    expect(store.folders.find(f => f.id === 'fa')).toBeUndefined();
    expect(store._srsMeta.every(c => c.folder_id !== 'fa')).toBe(true);
    expect(await store.countCards('fa')).toBe(0);
    const meta = await mirrorGetKV(store.mirror, 'srs_meta');
    expect(meta.every(c => c.folder_id !== 'fa')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('_patchSrsMeta debounces mirrorSetKV', async () => {
    vi.useFakeTimers();
    installFakeIDB({
      folders: [folderA],
      cards: [{ id: 'n1', folder_id: 'fa', front: 'a', back: 'b', description: '', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1 }],
      kv: { settings: DEFAULT_SETTINGS, srs_meta: [srsMeta[0]] },
    });
    vi.stubGlobal('navigator', { onLine: false, addEventListener: vi.fn() });
    const sq = await import('../js/data/sync-queue.ts');
    const spy = vi.spyOn(sq, 'mirrorSetKV');
    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const store = new CloudStore({ userId: () => 'u1' });
    await store.init();
    spy.mockClear();
    store._patchSrsMeta({ id: 'n1', folder_id: 'fa', sm2_reps: 1, sm2_due: now + 1000 });
    store._patchSrsMeta({ id: 'n1', folder_id: 'fa', sm2_reps: 2, sm2_due: now + 2000 });
    expect(spy).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
