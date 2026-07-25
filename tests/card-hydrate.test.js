// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  hydrateReviewQueue,
  hydrateReviewQueueReport,
  cardsByIdsFilter,
  missingHydrateIds,
} from '../js/data/card-hydrate.ts';

describe('card-hydrate', () => {
  it('hydrateReviewQueue silently drops missing ids (legacy)', () => {
    const byId = new Map([['a', { id: 'a', front: '1', back: '2' }]]);
    expect(hydrateReviewQueue([{ id: 'a' }, { id: 'b' }], byId).map(c => c.id)).toEqual(['a']);
  });

  it('hydrateReviewQueueReport returns missingIds', () => {
    const byId = new Map([['a', { id: 'a', front: '1', back: '2' }]]);
    const r = hydrateReviewQueueReport([{ id: 'a' }, { id: 'b' }, { id: 'c' }], byId);
    expect(r.cards.map(c => c.id)).toEqual(['a']);
    expect(r.missingIds).toEqual(['b', 'c']);
    expect(missingHydrateIds([{ id: 'b' }], byId)).toEqual(['b']);
  });

  it('cardsByIdsFilter builds PostgREST in-list', () => {
    const q = cardsByIdsFilter(['x', 'y']);
    expect(q).toContain('id=in.(x,y)');
    expect(q).toContain('select=');
    expect(q).toContain('front');
    expect(q).toContain('updated_at');
  });
});
