import { store } from '../../core/state.js';
import { el, toast, confirmDialog } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { svgNode, newBudget, featherIcon } from '../../ui/helpers.js';
import { boxSwatch } from '../../ui/icons.js';
import { shell, nav, offlineBanner } from '../../ui/shell.js';
import { backBtn } from '../../ui/navigation.js';
import { foldersInBox } from '../../data/store-box.js';
import { folderCardStatsFromHome, folderCardEl } from '../../ui/folder-cards.js';
import { attachFolderDraggable, createUnboxDropZone } from '../../ui/folder-drag.js';
import { route } from '../../core/router.js';
import { boxDialog, boxDeleteConfirm } from '../home/box-dialog.js';
import { folderDialog } from '../home/folder-dialog.js';
import type { Box, Folder } from '../../data/types.js';

export async function renderBox(boxId: string) {
  const box = store.boxes.find((b: Box) => b.id === boxId);
  if (!box) { nav('#home'); return; }

  const folders = foldersInBox(store.folders, boxId);
  const budget = newBudget();
  const homeStats = await store.getHomeStats();

  const head = el('div', { class: 'page-head' }, [
    backBtn('#home'),
    boxSwatch(box, { compact: true }),
    el('h2', { class: 'page-title grow' }, box.name),
    el('button', { class: 'icon-btn', title: 'Изменить', onclick: () => boxDialog(box) }, featherIcon()),
    el('button', {
      class: 'icon-btn',
      title: 'Удалить коробку',
      onclick: async () => {
        const c = boxDeleteConfirm(box);
        const yes = await confirmDialog(c.title, c.text, c.ok, true);
        if (!yes) return;
        await store.deleteBox(boxId);
        toast('Коробка удалена');
        nav('#home');
      },
    }, svgNode(ICONS.trash)),
  ]);

  const grid = el('div', { class: 'folder-grid' }, []);
  const rows = folders.map((f, i) => ({
    f,
    stats: folderCardStatsFromHome(homeStats, f, budget),
    i,
  }));
  const unboxZone = createUnboxDropZone(async (folderId: string) => {
    const folder = store.folders.find((f: Folder) => f.id === folderId);
    if (!folder || folder.box_id !== boxId) return;
    const ok = await store.assignFolderToBox(folderId, null);
    if (!ok) {
      toast('Не удалось вынести папку', 'error');
      return;
    }
    toast(`«${folder.name}» вынесена из коробки`);
    await route();
  });

  for (const { f, stats, i } of rows) {
    const card = folderCardEl(f, stats, i);
    attachFolderDraggable(card, f.id);
    grid.append(card);
  }
  grid.append(el('button', {
    class: 'add-tile stagger-in',
    style: { '--stagger-delay': (folders.length * 40) + 'ms' },
    onclick: () => folderDialog(null, { box_id: boxId }),
  }, '+ Новая папка') as HTMLButtonElement);

  const empty = !folders.length
    ? el('div', { class: 'empty box-empty' }, [
      el('p', null, 'В коробке пока нет папок. Добавьте существующие через «Изменить» или создайте новую.'),
    ])
    : null;

  shell('home', el('div', null, [
    offlineBanner(),
    head,
    unboxZone,
    el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Папки')),
    grid,
    empty,
  ]));
}
