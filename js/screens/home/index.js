import { store } from '../../core/state.js';
import { el, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowBox, initials, newBudget, svgNode } from '../../ui/helpers.js';
import { shell, nav, offlineBanner, refreshDueBadge } from '../../ui/shell.js';
import { folderDialog } from './folder-dialog.js';

export async function renderHome() {
  await refreshDueBadge();
  const dueAll = await store.countDue(null);
  const newAll = Math.min(await store.countNew(null), newBudget());
  const totalToStudy = dueAll + newAll;

  const hero = el('div', { class: 'review-hero' }, [
    crowBox('crow'),
    el('div', { class: 'grow' }, [
      el('h2', null, totalToStudy > 0
        ? `К повторению: ${totalToStudy} ${plural(totalToStudy, 'карточка', 'карточки', 'карточек')}`
        : 'Всё повторено. Кар!'),
      el('p', null, totalToStudy > 0
        ? 'Ворона ждёт — пара минут, и память скажет спасибо.'
        : 'Добавьте новые слова или загляните позже.'),
    ]),
    totalToStudy > 0
      ? el('button', { class: 'btn accent big', onclick: () => nav('#review') }, [svgNode(ICONS.play), 'Повторить'])
      : null,
  ]);

  const grid = el('div', { class: 'folder-grid' });
  for (let i = 0; i < store.folders.length; i++) {
    const f = store.folders[i];
    const n = await store.countCards(f.id);
    const due = (await store.countDue(f.id)) + Math.min(await store.countNew(f.id), newBudget());
    grid.append(el('div', {
      class: 'folder-card', style: { animationDelay: (i * 40) + 'ms' },
      onclick: () => nav('#folder/' + f.id),
    }, [
      el('div', { class: 'swatch', style: { background: f.color } }, initials(f.name)),
      el('h3', null, f.name),
      el('div', { class: 'meta' }, n + ' ' + plural(n, 'карточка', 'карточки', 'карточек')),
      due > 0 ? el('div', { class: 'due-chip' }, due + ' к повторению') : null,
    ]));
  }
  grid.append(el('button', {
    class: 'add-tile', style: { animationDelay: (store.folders.length * 40) + 'ms' },
    onclick: () => folderDialog(null),
  }, '+ Новая папка'));

  const content = [offlineBanner(), hero, el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Папки')), grid];
  if (!store.folders.length) {
    content.push(el('div', { class: 'empty' }, [
      crowBox('crow'),
      el('h3', null, 'Пока пусто'),
      el('p', null, 'Создайте папку — например, «Английский» или «Философия».'),
    ]));
  }
  shell('home', el('div', null, content));
}
