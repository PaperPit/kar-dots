import { store } from '../../core/state.js';
import { el, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowBox, emptyFoldersBox, scarecrowBox, svgNode, countUp } from '../../ui/helpers.js';
import { shell, nav, offlineBanner, refreshDueBadge } from '../../ui/shell.js';
import { homeCalendarWidget } from '../../ui/activity-calendar.js';
import { folderDialog } from './folder-dialog.js';
import { boxDialog } from './box-dialog.js';
import { studyModePicker } from '../review/mode-picker.js';
import { vocabPacksDialog } from '../../ui/vocab-packs-dialog.js';
import { looseFolders, boxFolderStats } from '../../data/store-box.js';
import { folderCardStats, folderCardEl, boxCardEl } from '../../ui/folder-cards.js';
import { newBudget } from '../../ui/helpers.js';

export async function renderHome() {
  const dueAll = await refreshDueBadge();
  const [newAllRaw, totalCards] = await Promise.all([
    store.countNew(null),
    store.countCards(null),
  ]);
  const newAll = Math.min(newAllRaw, newBudget());
  const totalToStudy = dueAll + newAll;
  const isWelcome = !store.folders.length && totalCards === 0 && !store.boxes.length;
  const hasFoldersNoCards = store.folders.length > 0 && totalCards === 0;

  let heroIcon, heroTitle, heroSub, heroBtn;
  let heroCountNode = null;
  if (totalToStudy > 0) {
    heroIcon = crowBox('crow');
    heroCountNode = el('span', { class: 'tnum' }, '0');
    heroTitle = ['К повторению: ', heroCountNode, ` ${plural(totalToStudy, 'карточка', 'карточки', 'карточек')}`];
    heroSub = 'Ворона ждёт — пара минут, и память скажет спасибо.';
    heroBtn = el('button', { class: 'btn accent big', onclick: () => studyModePicker({}) }, [svgNode(ICONS.play), 'Повторить']);
  } else if (isWelcome) {
    heroIcon = crowBox('crow');
    heroTitle = 'Кар! Рада знакомству';
    heroSub = 'Я — ворона вашей памяти. Создайте папку или коробку, добавьте слова — или установите готовый пак English A0–A2.';
    heroBtn = el('div', { class: 'hero-btns' }, [
      el('button', { class: 'btn accent big', onclick: () => folderDialog(null) }, 'Создать первую папку'),
      el('button', { class: 'btn big', onclick: () => vocabPacksDialog() }, 'Лексические паки'),
    ]);
  } else if (hasFoldersNoCards) {
    heroIcon = scarecrowBox();
    heroTitle = 'Поля ждут семена';
    heroSub = 'Папки уже есть, а слов пока нет. Откройте любую папку и посадите первые карточки — пугало прогонит лень.';
    heroBtn = null;
  } else {
    heroIcon = crowBox('crow');
    heroTitle = 'КАР-р-р! Сегодня ты был великолепен!!!';
    heroSub = 'Добавьте новые слова или загляните позже.';
    heroBtn = null;
  }

  const hero = el('div', { class: 'review-hero' }, [
    heroIcon,
    el('div', { class: 'grow' }, [
      el('h2', null, heroTitle),
      el('p', null, heroSub),
    ]),
    heroBtn,
  ]);

  const budget = newBudget();
  const loose = looseFolders(store.folders);

  const boxGrid = el('div', { class: 'folder-grid box-grid' });
  const boxRows = await Promise.all(store.boxes.map(async (b, i) => {
    const stats = await boxFolderStats(store, b.id, budget);
    return { b, stats, i };
  }));
  for (const { b, stats, i } of boxRows) {
    boxGrid.append(boxCardEl(b, stats, i));
  }
  boxGrid.append(el('button', {
    class: 'add-tile add-tile-box stagger-in',
    style: { '--stagger-delay': (store.boxes.length * 40) + 'ms' },
    onclick: () => boxDialog(null),
  }, '+ Новая коробка'));

  const folderGrid = el('div', { class: 'folder-grid' });
  const folderRows = await Promise.all(loose.map(async (f, i) => {
    const stats = await folderCardStats(store, f, budget);
    return { f, stats, i };
  }));
  for (const { f, stats, i } of folderRows) {
    folderGrid.append(folderCardEl(f, stats, i));
  }
  folderGrid.append(el('button', {
    class: 'add-tile stagger-in',
    style: { '--stagger-delay': (loose.length * 40) + 'ms' },
    onclick: () => folderDialog(null),
  }, '+ Новая папка'));

  const sections = [hero];

  sections.push(
    el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Коробки')),
    el('p', { class: 'section-hint' }, 'Объединяют папки по теме — карточки хранятся только в папках.'),
    boxGrid,
  );

  if (loose.length || !store.folders.length) {
    sections.push(
      el('div', { class: 'page-head section-head-spaced' }, el('h2', { class: 'page-title' }, 'Папки')),
      folderGrid,
    );
  }

  const mainCol = el('div', { class: 'home-main' }, sections);

  if (!store.folders.length && !store.boxes.length) {
    mainCol.append(el('div', { class: 'empty' }, [
      emptyFoldersBox(),
      el('h3', null, 'Пока пусто'),
      el('p', null, 'Создайте коробку или папку — например, «Английский» или «Философия».'),
    ]));
  }

  const calendarPlace = store.settings.calendarPlace
    ?? (store.settings.showCalendar === false ? 'hidden' : 'left');

  const calendarAside = calendarPlace !== 'hidden'
    ? homeCalendarWidget(calendarPlace)
    : null;

  shell('home', el('div', null, [
    offlineBanner(),
    el('div', { class: 'home-page' }, [mainCol]),
  ]), calendarAside);

  if (heroCountNode) countUp(heroCountNode, totalToStudy);
}
