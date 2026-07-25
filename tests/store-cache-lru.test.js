import { describe, it, expect } from 'vitest';
import { StoreCache, FOLDER_CACHE_MAX } from '../js/data/store-cache.ts';

describe('StoreCache folder LRU', () => {
  it('evicts oldest folder lists beyond FOLDER_CACHE_MAX', () => {
    const cache = new StoreCache();
    for (let i = 0; i < FOLDER_CACHE_MAX + 2; i++) {
      cache.setFolderList('f' + i, [{ id: 'c' + i }]);
    }
    expect(cache.folderCache.size).toBe(FOLDER_CACHE_MAX);
    expect(cache.folderCache.has('f0')).toBe(false);
    expect(cache.folderCache.has('f1')).toBe(false);
    expect(cache.folderCache.has('f2')).toBe(true);
  });

  it('getFolderList refreshes recency', () => {
    const cache = new StoreCache();
    for (let i = 0; i < FOLDER_CACHE_MAX; i++) {
      cache.setFolderList('f' + i, [{ id: 'c' + i }]);
    }
    cache.getFolderList('f0'); // touch oldest
    cache.setFolderList('fX', [{ id: 'cx' }]);
    expect(cache.folderCache.has('f0')).toBe(true);
    expect(cache.folderCache.has('f1')).toBe(false); // next-oldest evicted
  });
});
