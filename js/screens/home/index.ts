import { store } from '../../core/state.js';
import { el, toast } from '../../ui/ui.js';
import { route } from '../../core/router.js';
import { folderDragEnabled, attachFolderDraggable, attachBoxDropTarget } from '../../ui/folder-drag.js';
import { emptyFoldersBox, newBudget, reviewsBudget } from '../../ui/helpers.js';
import { shell, offlineBanner, setDueBadge } from '../../ui/shell.js';
import { homeStreakCalendarCard } from '../../ui/activity-calendar.js';
import { homeGreeting, homeDayCard } from '../../ui/home-day-card.js';
import { folderDialog } from './folder-dialog.js';
import { boxDialog } from './box-dialog.js';
import { studyModePicker } from '../review/mode-picker.js';
import { vocabPacksDialog } from '../../ui/vocab-packs-dialog.js';
import { looseFolders, boxFolderStatsFromHome } from '../../data/store-box.js';
import type { Folder } from '../../data/types.js';
import { folderCardStatsFromHome, folderCardEl, boxCardEl } from '../../ui/folder-cards.js';
import { todayStudyCount } from '../../data/home-stats.js';

export async function renderHome() {
  const budget = newBudget();
  const homeStats = await store.getHomeStats();
  const totalToStudy = Math.min(todayStudyCount(homeStats, budget), reviewsBudget());
  setDueBadge(totalToStudy);
  const totalCards = homeStats.totalCards;
  const isWelcome = !store.folders.length && totalCards === 0 && !store.boxes.length;

  const calendarPlaceRaw = store.settings.calendarPlace
    ?? (store.settings.showCalendar === 'right' ? 'right' : 'left');
  const calendarPlace = calendarPlaceRaw === 'right' ? 'right' : 'left';
  const isNarrow = typeof window !== 'undefined'
    && window.matchMedia('(max-width: 719px)').matches;

  const dayCard = homeDayCard(totalToStudy, () => studyModePicker({}));
  const calCard = homeStreakCalendarCard();
  const heroRowKids: HTMLElement[] = (!isNarrow && calendarPlace === 'left')
    ? [calCard, dayCard]
    : [dayCard, calCard];

  const loose = looseFolders(store.folders);
  const libraryGrid = el('div', { class: 'folder-grid library-grid' }, []);

  for (let i = 0; i < store.boxes.length; i++) {
    const b = store.boxes[i];
    const stats = boxFolderStatsFromHome(homeStats, store.folders, b.id, budget);
    const card = boxCardEl(b, stats, i);
    attachBoxDropTarget(card, b.id, async (folderId, boxId) => {
      const folder = store.folders.find((f: Folder) => f.id === folderId);
      if (!folder) return;
      if (folder.box_id === boxId) {
        toast('Папка уже в этой коробке');
        return;
      }
      const ok = await store.assignFolderToBox(folderId, boxId);
      if (!ok) {
        toast('Не удалось переместить папку', 'error');
        return;
      }
      toast(`«${folder.name}» → «${b.name}»`);
      await route();
    });
    libraryGrid.append(card);
  }

  for (let i = 0; i < loose.length; i++) {
    const f = loose[i]!;
    const stats = folderCardStatsFromHome(homeStats, f, budget);
    const card = folderCardEl(f, stats, store.boxes.length + i);
    attachFolderDraggable(card, f.id);
    libraryGrid.append(card);
  }

  libraryGrid.append(el('button', {
    class: 'add-tile add-tile-box stagger-in',
    style: { '--stagger-delay': ((store.boxes.length + loose.length) * 40) + 'ms' },
    onclick: () => boxDialog(null),
  }, '+ Новая коробка') as HTMLButtonElement);

  libraryGrid.append(el('button', {
    class: 'add-tile stagger-in',
    style: { '--stagger-delay': ((store.boxes.length + loose.length + 1) * 40) + 'ms' },
    onclick: () => folderDialog(null),
  }, '+ Новая папка') as HTMLButtonElement);

  const sections: HTMLElement[] = [
    homeGreeting(totalToStudy),
    el('div', { class: 'home-hero-row' }, heroRowKids),
  ];

  if (isWelcome) {
    sections.push(el('div', { class: 'home-welcome' }, [
      el('p', { class: 'home-welcome-text' },
        'Я — ворона вашей памяти. Создайте папку или коробку, добавьте слова — или установите готовый пак English A0–A2.'),
      el('div', { class: 'home-welcome-btns' }, [
        el('button', { class: 'btn accent big', onclick: () => folderDialog(null) }, 'Создать первую папку'),
        el('button', { class: 'btn big', onclick: () => vocabPacksDialog() }, 'Лексические паки'),
      ]),
    ]));
  }

  sections.push(
    el('div', { class: 'home-section-head home-library-head' }, [
      el('h2', { class: 'home-section-title' }, 'Библиотека'),
      el('span', { class: 'home-section-aside' }, 'коробки и папки'),
    ]),
  );

  if (folderDragEnabled() && store.boxes.length) {
    sections.push(el('p', { class: 'section-hint' }, 'Перетащите папку на коробку, чтобы объединить.'));
  }

  sections.push(libraryGrid);

  if (!store.folders.length && !store.boxes.length) {
    sections.push(el('div', { class: 'empty' }, [
      emptyFoldersBox(),
      el('h3', null, 'Пока пусто'),
      el('p', null, 'Создайте коробку или папку — например, «Английский» или «Философия».'),
    ]));
  }

  shell('home', el('div', null, [
    offlineBanner(),
    el('div', { class: 'home-page' }, sections),
  ]), null);
}
