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
import { t } from '../../lib/i18n.js';
import { nav } from '../../ui/navigation.js';

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

  // Плитка «Заметки» — первая в сетке библиотеки, в одном ритме с папками.
  let notesCount = 0;
  try {
    if (typeof store.listNotes === 'function') {
      const notes = await store.listNotes();
      notesCount = notes.length;
    }
  } catch (e) { /* notes store may be unavailable on old mirrors */ }

  libraryGrid.append(el('button', {
    class: 'notes-wall-tile stagger-in',
    type: 'button',
    style: { '--stagger-delay': '0ms' },
    onclick: () => nav('#notes'),
  }, [
    el('div', { class: 'notes-wall-kicker' }, t('home.notes.kicker')),
    el('h3', { class: 'notes-wall-title' }, t('home.notes.title')),
    el('div', { class: 'notes-wall-sub meta' }, notesCount
      ? t('home.notes.count', { n: notesCount })
      : t('home.notes.empty')),
  ]) as HTMLButtonElement);

  for (let i = 0; i < store.boxes.length; i++) {
    const b = store.boxes[i];
    if (!b) continue;
    const stats = boxFolderStatsFromHome(homeStats, store.folders, b.id, budget);
    const card = boxCardEl(b, stats, i + 1);
    attachBoxDropTarget(card, b.id, async (folderId, boxId) => {
      const folder = store.folders.find((f: Folder) => f.id === folderId);
      if (!folder) return;
      if (folder.box_id === boxId) {
        toast(t('home.toast.alreadyInBox'));
        return;
      }
      const ok = await store.assignFolderToBox(folderId, boxId);
      if (!ok) {
        toast(t('home.toast.moveFailed'), 'error');
        return;
      }
      toast(t('home.toast.moved', { folder: folder.name, box: b.name }));
      await route();
    });
    libraryGrid.append(card);
  }

  for (let i = 0; i < loose.length; i++) {
    const f = loose[i]!;
    const stats = folderCardStatsFromHome(homeStats, f, budget);
    const card = folderCardEl(f, stats, store.boxes.length + i + 1);
    attachFolderDraggable(card, f.id);
    libraryGrid.append(card);
  }

  libraryGrid.append(el('button', {
    class: 'add-tile add-tile-box stagger-in',
    style: { '--stagger-delay': ((store.boxes.length + loose.length + 1) * 40) + 'ms' },
    onclick: () => boxDialog(null),
  }, t('home.btn.newBox')) as HTMLButtonElement);

  libraryGrid.append(el('button', {
    class: 'add-tile stagger-in',
    style: { '--stagger-delay': ((store.boxes.length + loose.length + 2) * 40) + 'ms' },
    onclick: () => folderDialog(null),
  }, t('home.btn.newFolder')) as HTMLButtonElement);

  const sections: HTMLElement[] = [
    homeGreeting(totalToStudy),
    el('div', { class: 'home-hero-row' }, heroRowKids),
  ];

  if (isWelcome) {
    sections.push(el('div', { class: 'home-welcome' }, [
      el('p', { class: 'home-welcome-text' }, t('home.welcome.text')),
      el('div', { class: 'home-welcome-btns' }, [
        el('button', { class: 'btn accent big', onclick: () => folderDialog(null) }, t('home.welcome.createFolder')),
        el('button', { class: 'btn big', onclick: () => vocabPacksDialog() }, t('home.welcome.packs')),
      ]),
    ]));
  }

  sections.push(
    el('div', { class: 'home-section-head home-library-head' }, [
      el('h2', { class: 'home-section-title' }, t('home.section.library')),
      el('span', { class: 'home-section-aside' }, t('home.section.libraryAside')),
    ]),
  );

  if (folderDragEnabled() && store.boxes.length) {
    sections.push(el('p', { class: 'section-hint' }, t('home.hint.drag')));
  }

  sections.push(libraryGrid);

  if (!store.folders.length && !store.boxes.length) {
    sections.push(el('div', { class: 'empty' }, [
      emptyFoldersBox(),
      el('h3', null, t('home.empty.title')),
      el('p', null, t('home.empty.text')),
    ]));
  }

  shell('home', el('div', null, [
    offlineBanner(),
    el('div', { class: 'home-page' }, sections),
  ]), null);
}
