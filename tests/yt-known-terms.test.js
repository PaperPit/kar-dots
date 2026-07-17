import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bumpKnownTermsCache, loadKnownTermsForImport } from '../js/lib/yt-known-terms.js';

function mockStore(front = 'hello') {
  return {
    folders: [{ id: 'f1', name: 'Test' }],
    countCards: vi.fn().mockResolvedValue(1),
    scanFolderFronts: vi.fn().mockResolvedValue([{ front }]),
    getFolderCards: vi.fn(),
  };
}

describe('yt-known-terms cache', () => {
  beforeEach(() => {
    bumpKnownTermsCache(null);
  });

  it('повторный вызов не ходит в store повторно', async () => {
    const store = mockStore();
    global.fetch = vi.fn().mockRejectedValue(new Error('no manifest'));

    const a = await loadKnownTermsForImport(store, 'f1');
    const b = await loadKnownTermsForImport(store, 'f1');

    expect(a).toBe(b);
    expect(a.has('hello')).toBe(true);
    expect(store.scanFolderFronts).toHaveBeenCalledTimes(1);
  });

  it('bumpKnownTermsCache сбрасывает session-кэш', async () => {
    const store = mockStore();
    global.fetch = vi.fn().mockRejectedValue(new Error('no manifest'));

    await loadKnownTermsForImport(store, 'f1');
    bumpKnownTermsCache(null);
    await loadKnownTermsForImport(store, 'f1');

    expect(store.scanFolderFronts).toHaveBeenCalledTimes(2);
  });

  it('scanFolderFronts: youtubeOnly для чужих папок', async () => {
    const store = mockStore();
    global.fetch = vi.fn().mockRejectedValue(new Error('no manifest'));

    await loadKnownTermsForImport(store, 'f1');

    expect(store.scanFolderFronts).toHaveBeenCalledWith('f1', { youtubeOnly: false });
  });
});
