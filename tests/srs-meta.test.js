import { describe, it, expect } from 'vitest';
import {
  toSrsMeta,
  upsertSrsMeta,
  removeSrsMeta,
  removeSrsMetaForFolder,
  countSrsMetaByFolder,
  SRS_FIELDS,
} from '../js/data/srs-meta.js';

const fullCard = {
  id: 'c1',
  folder_id: 'f1',
  front: 'hello',
  back: 'world',
  sm2_ef: 2.5,
  sm2_reps: 1,
  sm2_ivl: 1,
  sm2_due: 1000,
  box: 1,
  box_due: 1000,
  created_at: 42,
};

describe('srs-meta', () => {
  it('SRS_FIELDS lists slim columns only', () => {
    expect(SRS_FIELDS).not.toContain('front');
    expect(SRS_FIELDS).toContain('sm2_due');
  });

  it('toSrsMeta strips content fields', () => {
    const slim = toSrsMeta(fullCard);
    expect(slim).toEqual({
      id: 'c1',
      folder_id: 'f1',
      sm2_ef: 2.5,
      sm2_reps: 1,
      sm2_ivl: 1,
      sm2_due: 1000,
      box: 1,
      box_due: 1000,
      created_at: 42,
    });
  });

  it('upsertSrsMeta inserts and updates in place', () => {
    const list = [];
    upsertSrsMeta(list, fullCard);
    expect(list).toHaveLength(1);
    upsertSrsMeta(list, { ...fullCard, sm2_reps: 3 });
    expect(list).toHaveLength(1);
    expect(list[0].sm2_reps).toBe(3);
  });

  it('removeSrsMeta and removeSrsMetaForFolder', () => {
    const list = [toSrsMeta(fullCard), toSrsMeta({ ...fullCard, id: 'c2', folder_id: 'f2' })];
    expect(removeSrsMeta(list, 'c1')).toHaveLength(1);
    expect(removeSrsMetaForFolder(list, 'f2')).toHaveLength(1);
  });

  it('countSrsMetaByFolder', () => {
    const list = [
      toSrsMeta(fullCard),
      toSrsMeta({ ...fullCard, id: 'c2' }),
      toSrsMeta({ ...fullCard, id: 'c3', folder_id: 'f2' }),
    ];
    const counts = countSrsMetaByFolder(list, [{ id: 'f1' }, { id: 'f2' }]);
    expect(counts.get('f1')).toBe(2);
    expect(counts.get('f2')).toBe(1);
  });
});
