// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import { DEFAULT_SETTINGS } from '../js/data/store-common.js';

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
    ({ CloudStore } = await import('../js/data/store-cloud.js'));
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
      { id: 'n1', folder_id: 'fa', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1 },
      { id: 'd1', folder_id: 'fa', sm2_reps: 2, sm2_due: now - 60_000, box: 1, box_due: now - 60_000, created_at: 2 },
      { id: 'f1', folder_id: 'fa', sm2_reps: 2, sm2_due: now + 86_400_000, box: 2, box_due: now + 86_400_000, created_at: 3 },
      { id: 'tm', folder_id: 'fa', sm2_reps: 1, sm2_due: now + 3_600_000, box: 1, box_due: now + 3_600_000, created_at: 4 },
      { id: 'n2', folder_id: 'fb', sm2_reps: 0, sm2_due: null, box: 0, created_at: 5 },
      { id: 'd2', folder_id: 'fb', sm2_reps: 1, sm2_due: now - 1_000, box: 1, box_due: now - 1_000, created_at: 6 },
    ];
    installFakeIDB({ folders: [], cards: [], kv: {} });
    vi.stubGlobal('navigator', { onLine: true, addEventListener: vi.fn() });
    const { CloudStore } = await import('../js/data/store-cloud.js');
    const sb = {
      userId: () => 'user-1',
      select: vi.fn(async (table, query) => {
        if (table === 'folders') return [folderA, folderB];
        if (table === 'cards' && query.includes('select=')) return cloudSrsMeta;
        if (table === 'settings') return [{ data: DEFAULT_SETTINGS }];
        return [];
      }),
    };
    const store = new CloudStore(sb);
    store.mirror = await (await import('../js/data/sync-queue.js')).openMirrorDB();
    await store._fetchFromCloud();
    expect(await store.countCards('fa')).toBe(4);
    expect(await store.countCards('fb')).toBe(2);
    expect(await store.countCards(null)).toBe(6);
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
    const { CloudStore } = await import('../js/data/store-cloud.js');
    const store = new CloudStore(sb);
    store.mirror = await (await import('../js/data/sync-queue.js')).openMirrorDB();
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
    const { CloudStore } = await import('../js/data/store-cloud.js');
    const store = new CloudStore({ userId: () => 'u1' });
    await store.init();
    await store.deleteCard('n1');
    expect(await store.countCards('fa')).toBe(0);
    expect(await store.countNew('fa', 'sm2')).toBe(0);
    vi.unstubAllGlobals();
  });
});
