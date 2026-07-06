import { describe, it, expect } from 'vitest';
import { StoreCache } from '../js/data/store-cache.js';

describe('StoreCache', () => {
  it('bumpCount and countCards', () => {
    const c = new StoreCache();
    c.setCount('f1', 2);
    c.bumpCount('f1', 1);
    expect(c.countCards('f1')).toBe(3);
    c.bumpCount('f1', -5);
    expect(c.countCards('f1')).toBe(0);
  });

  it('prependCard and removeCard', () => {
    const c = new StoreCache();
    c.folderCache.set('f1', [{ id: 'a' }]);
    c.prependCard('f1', { id: 'b' });
    expect(c.folderCache.get('f1').map(x => x.id)).toEqual(['b', 'a']);
    c.removeCard('f1', 'a');
    expect(c.folderCache.get('f1')).toHaveLength(1);
  });

  it('rebuildCountsFromSrsMeta', () => {
    const c = new StoreCache();
    const meta = [
      { id: '1', folder_id: 'f1' },
      { id: '2', folder_id: 'f1' },
      { id: '3', folder_id: 'f2' },
    ];
    c.rebuildCountsFromSrsMeta([{ id: 'f1' }, { id: 'f2' }], meta);
    expect(c.countCards('f1')).toBe(2);
    expect(c.countCards('f2')).toBe(1);
  });
});
