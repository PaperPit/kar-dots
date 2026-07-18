// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';

describe('SyncQueue — честная синхронизация: dead letter вместо тихого дропа', () => {
  let SyncQueue;
  let openMirrorDB;
  let db;

  beforeEach(async () => {
    installFakeIDB({});
    vi.stubGlobal('navigator', { onLine: true });
    ({ SyncQueue, openMirrorDB } = await import('../js/data/sync-queue.ts'));
    db = await openMirrorDB();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('removes an item and reports ok on success', async () => {
    const q = new SyncQueue();
    await q.init(db);
    await q.enqueue({ op: 'noop', payload: {} });
    q.onFlush(async () => {});
    const r = await q.flush();
    expect(r).toEqual({ ok: 1, fail: 0 });
    expect(await q.size()).toBe(0);
    expect(await q.deadLetterCount()).toBe(0);
  });

  it('keeps a failed item in the queue on network errors (retries later, no dead letter)', async () => {
    const q = new SyncQueue();
    await q.init(db);
    await q.enqueue({ op: 'updateCard', payload: {} });
    q.onFlush(async () => { throw new Error('Failed to fetch'); });
    const r = await q.flush();
    expect(r).toEqual({ ok: 0, fail: 0 });
    expect(await q.size()).toBe(1);
    expect(await q.deadLetterCount()).toBe(0);
  });

  it('moves a permanently failed (non-network) item to dead letters instead of dropping it', async () => {
    const q = new SyncQueue();
    await q.init(db);
    await q.enqueue({ op: 'updateCard', payload: { id: 'c1', patch: { front: 'x' } } });
    const onDead = vi.fn();
    q.onDeadLetter(onDead);
    q.onFlush(async () => { throw new Error('permission denied'); });

    const r = await q.flush();

    expect(r).toEqual({ ok: 0, fail: 1 });
    expect(await q.size()).toBe(0); // не осталось в рабочей очереди навсегда
    expect(onDead).toHaveBeenCalledTimes(1);

    const letters = await q.deadLetters();
    expect(letters).toHaveLength(1);
    expect(letters[0].op).toBe('updateCard');
    expect(letters[0].error).toContain('permission denied');
    expect(letters[0].payload).toEqual({ id: 'c1', patch: { front: 'x' } });
  });

  it('retryDeadLetter moves the item back into the sync queue', async () => {
    const q = new SyncQueue();
    await q.init(db);
    await q.enqueue({ op: 'updateCard', payload: { id: 'c1' } });
    q.onFlush(async () => { throw new Error('boom'); });
    await q.flush();

    const [letter] = await q.deadLetters();
    const ok = await q.retryDeadLetter(letter.id);

    expect(ok).toBe(true);
    expect(await q.deadLetterCount()).toBe(0);
    expect(await q.size()).toBe(1);
  });

  it('retryDeadLetter returns false for an unknown id', async () => {
    const q = new SyncQueue();
    await q.init(db);
    expect(await q.retryDeadLetter(999)).toBe(false);
  });

  it('discardDeadLetter removes the item permanently', async () => {
    const q = new SyncQueue();
    await q.init(db);
    await q.enqueue({ op: 'updateCard', payload: {} });
    q.onFlush(async () => { throw new Error('boom'); });
    await q.flush();

    const [letter] = await q.deadLetters();
    await q.discardDeadLetter(letter.id);

    expect(await q.deadLetterCount()).toBe(0);
    expect(await q.size()).toBe(0);
  });

  it('stops flushing remaining items after a network error (does not skip ahead)', async () => {
    const q = new SyncQueue();
    await q.init(db);
    await q.enqueue({ op: 'a', payload: {} });
    await q.enqueue({ op: 'b', payload: {} });
    q.onFlush(async () => { throw new Error('network error'); });
    const r = await q.flush();
    expect(r).toEqual({ ok: 0, fail: 0 });
    expect(await q.size()).toBe(2);
    expect(await q.deadLetterCount()).toBe(0);
  });
});
