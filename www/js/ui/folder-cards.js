import { el, plural } from './ui.js';
import { folderSwatch, boxSwatch } from './icons.js';
import { nav } from './navigation.js';

export async function folderCardStats(store, folder, budget) {
  const [n, dueCount, newCount] = await Promise.all([
    store.countCards(folder.id),
    store.countDue(folder.id),
    store.countNew(folder.id),
  ]);
  return { n, due: dueCount + Math.min(newCount, budget) };
}

export function folderCardEl(folder, { n, due }, i) {
  return el('div', {
    class: 'folder-card stagger-in',
    style: { '--stagger-delay': (i * 40) + 'ms' },
    onclick: () => nav('#folder/' + folder.id),
  }, [
    folderSwatch(folder),
    el('h3', null, folder.name),
    el('div', { class: 'meta' }, n + ' ' + plural(n, 'карточка', 'карточки', 'карточек')),
    folder.pack_id ? el('div', { class: 'pack-chip' }, 'Лексический пак') : null,
    due > 0 ? el('div', { class: 'due-chip' }, due + ' к повторению') : null,
  ]);
}

export function boxCardEl(box, stats, i) {
  const { folders, cards, due } = stats;
  const metaParts = [
    folders + ' ' + plural(folders, 'папка', 'папки', 'папок'),
    cards + ' ' + plural(cards, 'карточка', 'карточки', 'карточек'),
  ];
  return el('div', {
    class: 'box-card stagger-in',
    style: { '--stagger-delay': (i * 40) + 'ms' },
    onclick: () => nav('#box/' + box.id),
  }, [
    boxSwatch(box),
    el('h3', null, box.name),
    el('div', { class: 'meta' }, metaParts.join(' · ')),
    due > 0 ? el('div', { class: 'due-chip' }, due + ' к повторению') : null,
  ]);
}
