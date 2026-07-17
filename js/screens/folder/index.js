import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import { el, toast, confirmDialog, stripHtml, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowTombIcon, featherIcon, folderSwatch, newBudget, svgNode, textPreview } from '../../ui/helpers.js';
import { shell, nav, offlineBanner } from '../../ui/shell.js';
import { backBtn } from '../../ui/navigation.js';
import { folderDialog } from '../home/folder-dialog.js';
import { cardDialog } from '../card-editor/index.js';
import { bulkCardDialog } from '../card-editor/bulk-dialog.js';
import { youtubeImportDialog } from './youtube-dialog.js';
import { studyModePicker } from '../review/mode-picker.js';
import { isVocabPackFolder } from '../../lib/vocab-packs.js';
import { route } from '../../core/router.js';
import { createVirtualList, VIRTUAL_LIST_THRESHOLD } from '../../lib/virtual-list.js';
import { buildHomeStats, folderStudyDue } from '../../data/home-stats.js';

const CARD_ROW_HEIGHT = 74;
const CARD_ROW_GAP = 10;

function matchesSearch(card, query) {
  if (!query) return true;
  const hay = [
    stripHtml(card.front),
    stripHtml(card.back),
    stripHtml(card.description || ''),
  ].join(' ').toLowerCase();
  return hay.includes(query.toLowerCase());
}

export async function renderFolder(folderId) {
  const folder = store.folders.find(f => f.id === folderId);
  if (!folder) { nav('#home'); return; }

  const cards = await store.getFolderCards(folderId);
  const algo = store.settings.algo;
  const now = Date.now();
  const due = folderStudyDue(buildHomeStats(cards, algo, now).byFolder[folderId], newBudget());

  const isPack = isVocabPackFolder(folder);

  const head = el('div', { class: 'page-head' }, [
    backBtn('#home'),
    folderSwatch(folder, { compact: true }),
    el('h2', { class: 'page-title grow' }, folder.name),
    isPack ? null : el('button', { class: 'icon-btn', title: 'Переименовать', onclick: () => folderDialog(folder) }, featherIcon()),
    el('button', {
      class: 'icon-btn', title: isPack ? 'Удалить пак' : 'Удалить папку',
      onclick: async () => {
        const yes = await confirmDialog(isPack ? 'Удалить лексический пак?' : 'Удалить папку?',
          isPack
            ? `«${folder.name}» и все ${cards.length} ${plural(cards.length, 'карточка', 'карточки', 'карточек')} будут удалены.`
            : `«${folder.name}» и все её карточки (${cards.length}) будут удалены навсегда.`,
          isPack ? 'Удалить пак' : 'Удалить', true,
          crowTombIcon());
        if (!yes) return;
        if (isPack && folder.pack_id) await store.deleteVocabPack(folder.pack_id);
        else await store.deleteFolder(folderId);
        toast(isPack ? 'Пак удалён' : 'Папка удалена');
        nav('#home');
      },
    }, svgNode(ICONS.trash)),
  ]);

  const reviewBtn = due > 0 ? el('button', {
    class: 'btn accent folder-action-wide',
    onclick: () => studyModePicker({ folderId }),
  }, [svgNode(ICONS.play), `Повторить (${due})`]) : null;

  const addRow = el('div', { class: 'folder-actions-pair' }, [
    el('button', { class: 'btn', onclick: () => cardDialog(folderId) }, [svgNode(ICONS.plus), 'Добавить карточку']),
    el('button', { class: 'btn', onclick: () => bulkCardDialog(folderId) }, [svgNode(ICONS.plus), 'Добавить списком']),
  ]);

  const ytBtn = isPack ? null : el('button', {
    class: 'btn folder-action-wide',
    onclick: () => youtubeImportDialog(folderId),
  }, [svgNode(ICONS.youtube), 'Карточки из YouTube']);

  const cramBtn = cards.length ? el('button', {
    class: 'btn' + (due > 0 ? '' : ' accent') + ' folder-action-wide',
    onclick: () => studyModePicker({ folderId, cram: true }),
  }, [svgNode(ICONS.play), 'Повторять все карточки']) : null;

  const actions = el('div', { class: 'folder-actions' }, [
    reviewBtn,
    addRow,
    ytBtn,
    cramBtn,
  ].filter(Boolean));

  let filterMode = 'all';
  const searchInput = el('input', {
    type: 'search',
    class: 'input folder-search',
    placeholder: 'Поиск по карточкам…',
    autocomplete: 'off',
  });

  const filterSeg = el('div', { class: 'seg folder-filter-seg' });
  const filterAllBtn = el('button', { class: 'active', type: 'button' }, 'Все');
  const filterDueBtn = el('button', { type: 'button' }, 'К повторению');
  filterSeg.append(filterAllBtn, filterDueBtn);

  const toolbar = el('div', { class: 'folder-toolbar' }, [
    searchInput,
    filterSeg,
  ]);

  const listMount = el('div', { class: 'card-list' });
  const emptyFilter = el('p', { class: 'folder-filter-empty muted hidden' }, 'Ничего не найдено');
  let virtualList = null;

  function buildFilteredItems() {
    const q = searchInput.value.trim();
    const items = [];
    cards.forEach((c, i) => {
      if (filterMode === 'due' && !SRS.isReviewable(c, algo, now)) return;
      if (!matchesSearch(c, q)) return;
      items.push({ card: c, i });
    });
    return items;
  }

  function updateEmptyState(shown) {
    emptyFilter.classList.toggle('hidden', shown > 0 || !cards.length);
    if (shown === 0 && cards.length && (searchInput.value.trim() || filterMode === 'due')) {
      emptyFilter.textContent = filterMode === 'due' && !searchInput.value.trim()
        ? 'Сейчас нет карточек к повторению'
        : 'Ничего не найдено';
    }
  }

  function paintListPlain(items) {
    listMount.innerHTML = '';
    listMount.className = 'card-list';
    for (const { card, i } of items) {
      listMount.append(cardRow(card, i, algo, false));
    }
  }

  function paintListVirtual(items, scrollRoot) {
    if (!virtualList) {
      virtualList = createVirtualList({
        scrollRoot,
        mount: listMount,
        items,
        rowHeight: CARD_ROW_HEIGHT,
        gap: CARD_ROW_GAP,
        renderRow: ({ card, i }) => cardRow(card, i, algo, true),
      });
    } else {
      virtualList.setItems(items);
    }
  }

  function paintList() {
    const items = buildFilteredItems();
    updateEmptyState(items.length);

    const useVirtual = cards.length >= VIRTUAL_LIST_THRESHOLD;
    if (!useVirtual) {
      virtualList?.destroy();
      virtualList = null;
      paintListPlain(items);
      return;
    }

    const scrollRoot = listMount.closest('.main') || document.querySelector('.main');
    if (!scrollRoot) {
      paintListPlain(items);
      return;
    }
    paintListVirtual(items, scrollRoot);
  }

  function setFilter(mode) {
    filterMode = mode;
    filterAllBtn.classList.toggle('active', mode === 'all');
    filterDueBtn.classList.toggle('active', mode === 'due');
    paintList();
  }

  filterAllBtn.addEventListener('click', () => setFilter('all'));
  filterDueBtn.addEventListener('click', () => setFilter('due'));
  searchInput.addEventListener('input', () => paintList());

  const wrap = el('div', { class: 'folder-page' + (!cards.length ? ' is-empty' : '') });
  const content = [offlineBanner(), head];
  if (isPack) {
    content.push(el('p', { class: 'pack-folder-note muted' }, 'Лексический пак — удаляется целиком через 🗑 или в Настройки → Каталог паков.'));
  }
  content.push(actions);
  if (cards.length) {
    content.push(toolbar, listMount, emptyFilter);
  }
  content.forEach(node => { if (node) wrap.append(node); });
  shell('home', wrap);
  paintList();
  if (virtualList) {
    requestAnimationFrame(() => virtualList.refresh());
  }

  function cardRow(c, i, algoName, virtual) {
    const img = c.front_img || c.back_img;
    let chip;
    if (SRS.isNew(c, algoName)) chip = el('span', { class: 'srs-chip new' }, 'новая');
    else if (SRS.isDue(c, algoName, now)) chip = el('span', { class: 'srs-chip due' }, 'пора');
    else {
      const d = SRS.dueOf(c, algoName);
      chip = el('span', { class: 'srs-chip' }, 'через ' + SRS.fmtDays(Math.max(1, Math.round((d - Date.now()) / 86400000))));
    }
    const rowClass = virtual ? 'card-row' : 'card-row stagger-in';
    const rowStyle = virtual ? null : { '--stagger-delay': Math.min(i * 30, 400) + 'ms' };
    const row = el('div', {
      class: rowClass,
      style: rowStyle,
      onclick: () => cardDialog(c.folder_id, c),
    }, [
      img ? el('img', {
        class: 'thumb',
        src: img,
        alt: '',
        loading: virtual ? 'lazy' : 'eager',
        decoding: 'async',
      }) : null,
      el('div', { class: 'texts' }, [
        el('div', { class: 'front' }, stripHtml(c.front) || '(картинка)'),
        el('div', { class: 'back' }, stripHtml(c.back) || ''),
      ]),
      chip,
      el('button', {
        class: 'icon-btn', title: 'Удалить',
        onclick: async e => {
          e.stopPropagation();
          const yes = await confirmDialog('Удалить карточку?', textPreview(c), 'Удалить', true, crowTombIcon());
          if (!yes) return;
          row.classList.add('removing');
          setTimeout(async () => {
            await store.deleteCard(c.id);
            await route();
            toast('Карточка удалена');
          }, 250);
        },
      }, svgNode(ICONS.trash)),
    ]);
    return row;
  }
}
