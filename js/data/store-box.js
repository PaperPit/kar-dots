/** Коробки — группы папок (без карточек). */

export function foldersInBox(folders, boxId) {
  return folders.filter(f => f.box_id === boxId);
}

export function looseFolders(folders) {
  return folders.filter(f => !f.box_id);
}

export async function boxFolderStats(store, boxId, budget) {
  const folders = foldersInBox(store.folders, boxId);
  let cards = 0;
  let due = 0;
  for (const f of folders) {
    const [n, dueCount, newCount] = await Promise.all([
      store.countCards(f.id),
      store.countDue(f.id),
      store.countNew(f.id),
    ]);
    cards += n;
    due += dueCount + Math.min(newCount, budget);
  }
  return { folders: folders.length, cards, due };
}

export function clearBoxFromFolders(folders, boxId) {
  for (const f of folders) {
    if (f.box_id === boxId) f.box_id = null;
  }
}
