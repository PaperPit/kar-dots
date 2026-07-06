import { describe, it, expect } from 'vitest';
import {
  buildReviewQueue, countDueInList, countNewInList, countDueBetweenInList,
  countDueForFolder, filterByFolder,
} from '../js/data/srs-query.js';

const now = Date.now();
const cards = [
  { id: '1', folder_id: 'a', sm2_reps: 0, sm2_due: null, box: 0 },
  { id: '2', folder_id: 'a', sm2_reps: 1, sm2_due: now - 1000, box: 1, box_due: now - 1000 },
  { id: '3', folder_id: 'b', sm2_reps: 0, sm2_due: null, box: 0 },
];

describe('srs-query', () => {
  it('filterByFolder', () => {
    expect(filterByFolder(cards, 'a')).toHaveLength(2);
    expect(filterByFolder(cards, null)).toHaveLength(3);
  });

  it('countDueInList sm2', () => {
    expect(countDueInList(cards, 'sm2', now)).toBe(1);
  });

  it('countNewInList sm2', () => {
    expect(countNewInList(cards, 'sm2')).toBe(2);
  });

  it('countDueBetweenInList sm2', () => {
    expect(countDueBetweenInList(cards, 'sm2', now - 2000, now)).toBe(1);
  });

  it('countDueForFolder', () => {
    expect(countDueForFolder(cards, 'a', 'sm2', now)).toBe(1);
    expect(countDueForFolder(cards, null, 'sm2', now)).toBe(1);
  });

  it('buildReviewQueue limits fresh', () => {
    const { due, fresh } = buildReviewQueue(cards, 'sm2', 1, now);
    expect(due).toHaveLength(1);
    expect(fresh).toHaveLength(1);
  });
});
