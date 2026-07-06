import * as SRS from '../lib/srs.js';
import { shuffle } from '../lib/shuffle.js';

/** Shared SRS predicates for cursor scans (LocalStore) and in-memory lists (CloudStore). */
export const srsMatch = {
  due: (c, algo, now) => SRS.isDue(c, algo, now),
  dueBetween: (c, algo, from, to) => SRS.isDueBetween(c, algo, from, to),
  isNew: (c, algo) => SRS.isNew(c, algo),
};

export function filterByFolder(cards, folderId) {
  if (!folderId) return cards;
  return cards.filter(c => c.folder_id === folderId);
}

function countWhere(cards, pred) {
  let n = 0;
  for (const c of cards) if (pred(c)) n++;
  return n;
}

export function countDueInList(cards, algo, now) {
  return countWhere(cards, c => srsMatch.due(c, algo, now));
}

export function countDueBetweenInList(cards, algo, from, to) {
  return countWhere(cards, c => srsMatch.dueBetween(c, algo, from, to));
}

export function countNewInList(cards, algo) {
  return countWhere(cards, c => srsMatch.isNew(c, algo));
}

export function countDueForFolder(cards, folderId, algo, now) {
  return countDueInList(filterByFolder(cards, folderId), algo, now);
}

export function countDueBetweenForFolder(cards, folderId, algo, from, to) {
  return countDueBetweenInList(filterByFolder(cards, folderId), algo, from, to);
}

export function countNewForFolder(cards, folderId, algo) {
  return countNewInList(filterByFolder(cards, folderId), algo);
}

export function buildReviewQueue(cards, algo, newLimit, now) {
  const due = [];
  const fresh = [];
  for (const c of cards) {
    if (srsMatch.due(c, algo, now)) due.push(c);
    else if (srsMatch.isNew(c, algo)) fresh.push(c);
  }
  return { due: shuffle(due), fresh: shuffle(fresh).slice(0, newLimit) };
}
