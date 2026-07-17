// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';

const now = 1_700_000_000_000;
const folderA = { id: 'fa', name: 'A', color: '#000', created_at: 1 };
const folderB = { id: 'fb', name: 'B', color: '#111', created_at: 2 };

const cards = [
  { id: 'n1', folder_id: 'fa', sm2_reps: 0, sm2_due: null, box: 0, created_at: 1 },
  { id: 'd1', folder_id: 'fa', sm2_reps: 2, sm2_due: now - 60_000, box: 1, box_due: now - 60_000, created_at: 2 },
  { id: 'f1', folder_id: 'fa', sm2_reps: 2, sm2_due: now + 86_400_000, box: 2, box_due: now + 86_400_000, created_at: 3 },
  { id: 'tm', folder_id: 'fa', sm2_reps: 1, sm2_due: now + 3_600_000, box: 1, box_due: now + 3_600_000, created_at: 4 },
  { id: 'n2', folder_id: 'fb', sm2_reps: 0, sm2_due: null, box: 0, created_at: 5 },
  { id: 'd2', folder_id: 'fb', sm2_reps: 1, sm2_due: now - 1_000, box: 1, box_due: now - 1_000, created_at: 6 },
];

describe('LocalStore SRS counts', () => {
  let LocalStore;
  let store;

  beforeEach(async () => {
    installFakeIDB({ folders: [folderA, folderB], cards });
    const RealDate = globalThis.Date;
    vi.stubGlobal('Date', class extends RealDate {
      constructor(...args) {
        if (args.length === 0) return new RealDate(now);
        return new RealDate(...args);
      }
      static now() { return now; }
    });
    ({ LocalStore } = await import('../js/data/store-local.js'));
    store = new LocalStore();
    await store.init();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('countDue all folders (sm2)', async () => {
    expect(await store.countDue(null, 'sm2')).toBe(2);
  });

  it('countDue single folder', async () => {
    expect(await store.countDue('fa', 'sm2')).toBe(1);
    expect(await store.countDue('fb', 'sm2')).toBe(1);
  });

  it('countNew', async () => {
    expect(await store.countNew(null, 'sm2')).toBe(2);
    expect(await store.countNew('fa', 'sm2')).toBe(1);
  });

  it('countDueBetween', async () => {
    const from = now;
    const to = now + 7_200_000;
    expect(await store.countDueBetween(null, 'sm2', from, to)).toBe(1);
    expect(await store.countDueBetween('fa', 'sm2', from, to)).toBe(1);
  });

  it('countDue leitner', async () => {
    expect(await store.countDue(null, 'leitner')).toBe(2);
  });

  it('getHomeStats — один проход, те же цифры', async () => {
    const stats = await store.getHomeStats();
    expect(stats.dueAll).toBe(await store.countDue(null, 'sm2'));
    expect(stats.newAllRaw).toBe(await store.countNew(null, 'sm2'));
    expect(typeof stats.dueTomorrowAll).toBe('number');
    expect(stats.totalCards).toBe(6);
    expect(stats.byFolder.fa.n).toBe(4);
  });

  it('getReviewCards — только карточки из очереди', async () => {
    const { due, fresh } = await store.getReviewCards(null, 'sm2', 5, now);
    expect(due.map(c => c.id).sort()).toEqual(['d1', 'd2']);
    expect(fresh.map(c => c.id).sort()).toEqual(['n1', 'n2']);
  });

  it('getCramCards с limit — hydrate только N', async () => {
    const queue = await store.getCramCards('fa', 2);
    expect(queue).toHaveLength(2);
    expect(queue.every(c => c.folder_id === 'fa' && c.id)).toBe(true);
  });

  it('updateCard по id без полного cursor', async () => {
    await store.updateCard('d1', { front: 'updated' });
    const c = await store._getCardById('d1');
    expect(c.front).toBe('updated');
  });

  it('srs_meta переживает re-init без полного rebuild при match count', async () => {
    await store._persistSrsMeta();
    const nBefore = store._srsMeta.length;
    const store2 = new LocalStore();
    await store2.init();
    expect(store2._srsMeta).toHaveLength(nBefore);
    expect(await store2.countDue(null, 'sm2')).toBe(2);
  });

  it('_srsMeta обновляется при createCard', async () => {
    const c = await store.createCard({ folder_id: 'fa', front: 'x', back: 'y' });
    expect(store._srsMeta.some(m => m.id === c.id)).toBe(true);
    expect(await store.countCards('fa')).toBe(5);
  });
});
