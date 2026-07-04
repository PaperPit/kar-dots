import { store } from '../../core/state.js';
import { el, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowBox, emptyFoldersBox, initials, newBudget, scarecrowBox, svgNode, countUp } from '../../ui/helpers.js';
import { shell, nav, offlineBanner, refreshDueBadge } from '../../ui/shell.js';
import { homeCalendarWidget } from '../../ui/activity-calendar.js';
import { folderDialog } from './folder-dialog.js';

export async function renderHome() {
  await refreshDueBadge();
  const dueAll = await store.countDue(null);
  const newAll = Math.min(await store.countNew(null), newBudget());
  const totalToStudy = dueAll + newAll;
  const totalCards = await store.countCards(null);
  const isWelcome = !store.folders.length && totalCards === 0;
  const hasFoldersNoCards = store.folders.length > 0 && totalCards === 0;

  let heroIcon, heroTitle, heroSub, heroBtn;
  let heroCountNode = null;
  if (totalToStudy > 0) {
    heroIcon = crowBox('crow');
    heroCountNode = el('span', { class: 'tnum' }, '0');
    heroTitle = ['К повторению: ', heroCountNode, ` ${plural(totalToStudy, 'карточка', 'карточки', 'карточек')}`];
    heroSub = 'Ворона ждёт — пара минут, и память скажет спасибо.';
    heroBtn = el('button', { class: 'btn accent big', onclick: () => nav('#review') }, [svgNode(ICONS.play), 'Повторить']);
  } else if (isWelcome) {
    heroIcon = crowBox('crow');
    heroTitle = 'Кар! Рада знакомству';
    heroSub = 'Я — ворона вашей памяти. Создайте папку, добавьте первые слова — и мы начнём повторять их вместе, по чуть-чуть, но надолго.';
    heroBtn = el('button', { class: 'btn accent big', onclick: () => folderDialog(null) }, 'Создать первую папку');
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

  const mainCol = el('div', { class: 'home-main' }, [
    hero,
    el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Папки')),
    grid,
  ]);

  if (!store.folders.length) {
    mainCol.append(el('div', { class: 'empty' }, [
      emptyFoldersBox(),
      el('h3', null, 'Пока пусто'),
      el('p', null, 'Создайте папку — например, «Английский» или «Философия».'),
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
