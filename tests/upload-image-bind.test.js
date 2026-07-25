// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { installFakeIDB } from './fake-idb.js';
import { DEFAULT_SETTINGS } from '../js/data/store-common.ts';

async function queueItems(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('sync_queue').objectStore('sync_queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

describe('uploadImage queue binds cardId/side', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bindUploadImages + cloud-safe createCard strip data:', async () => {
    installFakeIDB({ folders: [], cards: [], kv: { settings: DEFAULT_SETTINGS } });
    vi.stubGlobal('navigator', { onLine: false, addEventListener: vi.fn() });

    const { CloudStore } = await import('../js/data/store-cloud.ts');
    const store = new CloudStore({ userId: () => 'user-1' });
    await store.init();

    const dataUrl = 'data:image/png;base64,aaa';
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    await store.queue.enqueue({
      op: 'uploadImage',
      payload: { path: 'u/x.png', blob, contentType: 'image/png', dataUrl },
    });

    const row = await store.createCard({
      folder_id: 'fa',
      front: 'a',
      back: 'b',
      front_img: dataUrl,
    });

    const items = await queueItems(store.mirror);
    const upload = items.find(i => i.op === 'uploadImage');
    expect(upload.payload.cardId).toBe(row.id);
    expect(upload.payload.side).toBe('front_img');

    const create = items.find(i => i.op === 'createCard');
    expect(create.payload.row.front_img).toBeNull();
    expect(row.front_img).toBe(dataUrl);
  });
});
