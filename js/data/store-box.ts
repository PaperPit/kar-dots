/** Коробки — группы папок (без карточек). */

import { boxStudyDue } from './home-stats.js';

export function foldersInBox(folders, boxId) {
  return folders.filter(f => f.box_id === boxId);
}

export function looseFolders(folders) {
  return folders.filter(f => !f.box_id);
}

/** @param {import('./home-stats.js').HomeStats} [homeStats] */
export function boxFolderStatsFromHome(homeStats, folders, boxId, budget) {
  const inBox = foldersInBox(folders, boxId);
  let cards = 0;
  for (const f of inBox) {
    cards += homeStats?.byFolder?.[f.id]?.n ?? 0;
  }
  const due = boxStudyDue(homeStats, inBox.map(f => f.id), budget);
  return { folders: inBox.length, cards, due };
}

export async function boxFolderStats(store, boxId, budget, homeStats) {
  if (homeStats) return boxFolderStatsFromHome(homeStats, store.folders, boxId, budget);
  const folders = foldersInBox(store.folders, boxId);
  let cards = 0;
  let dueSum = 0;
  let newSum = 0;
  for (const f of folders) {
    const [n, dueCount, newCount] = await Promise.all([
      store.countCards(f.id),
      store.countDue(f.id),
      store.countNew(f.id),
    ]);
    cards += n;
    dueSum += dueCount;
    newSum += newCount;
  }
  return {
    folders: folders.length,
    cards,
    due: dueSum + Math.min(newSum, Math.max(0, Number(budget) || 0)),
  };
}

export function clearBoxFromFolders(folders, boxId) {
  for (const f of folders) {
    if (f.box_id === boxId) f.box_id = null;
  }
}
