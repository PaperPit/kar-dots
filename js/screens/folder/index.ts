import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import type { SrsCard, Algo } from '../../lib/srs.js';
import type { Folder } from '../../data/types.js';
import { el, toast, confirmDialog, plural } from '../../ui/ui.js';
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
import {
  createVirtualList,
  VIRTUAL_LIST_THRESHOLD,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_GAP,
} from '../../lib/virtual-list.js';
import { buildHomeStats, folderStudyDue } from '../../data/home-stats.js';
import { debounce } from '../../lib/debounce.js';
import { buildCardSearchIndex, matchesSearchIndex } from '../../lib/card-search.js';
import { offerUndoDeleteCard, offerUndoDeleteFolder } from '../../lib/undo-delete.js';
import { route } from '../../core/router.js';

type ListItem = {
  card: SrsCard;
  i: number;
  frontPlain: string;
  backPlain: string;
};

export async function renderFolder(folderId: string) {
  const folder = (store.folders as Folder[]).find(f => f.id === folderId);
  if (!folder) { nav('#home'); return; }

  let cards = (await store.getFolderCards(folderId)) as SrsCard[];
  const algo = store.settings.algo as Algo;
  const now = Date.now();
  let due = folderStudyDue(buildHomeStats(cards, algo, now).byFolder[folderId], newBudget());

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
        if (isPack && folder.pack_id) {
          await store.deleteVocabPack(folder.pack_id);
          toast('Пак удалён');
          nav('#home');
          return;
        }
        const folderSnap = { ...folder };
        const cardsSnap = cards.map((c) => ({ ...c }));
        await store.deleteFolder(folderId);
        nav('#home');
        offerUndoDeleteFolder(folderSnap, cardsSnap, () => route());
      },
    }, svgNode(ICONS.trash)),
  ]);

  const reviewBtn = due > 0 ? el('button', {
    class: 'btn accent folder-action-wide',
    onclick: () => studyModePicker({ folderId }),
  }, [svgNode(ICONS.play), `Повторить (${due})`]) as HTMLButtonElement : null;

  const addRow = el('div', { class: 'folder-actions-pair' }, [
    el('button', { class: 'btn', onclick: () => cardDialog(folderId, undefined) }, [svgNode(ICONS.plus), 'Добавить карточку']),
    el('button', { class: 'btn', onclick: () => bulkCardDialog(folderId) }, [svgNode(ICONS.plus), 'Добавить списком']),
  ]);

  const ytBtn = isPack ? null : el('button', {
    class: 'btn folder-action-wide',
    onclick: () => youtubeImportDialog(folderId),
  }, [svgNode(ICONS.youtube), 'Карточки из YouTube']) as HTMLButtonElement;

  const cramBtn = cards.length ? el('button', {
    class: 'btn' + (due > 0 ? '' : ' accent') + ' folder-action-wide',
    onclick: () => studyModePicker({ folderId, cram: true }),
  }, [svgNode(ICONS.play), 'Повторять все карточки']) as HTMLButtonElement : null;

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
  }, []) as HTMLInputElement;

  const filterSeg = el('div', { class: 'seg folder-filter-seg' }, []);
  const filterAllBtn = el('button', { class: 'active', type: 'button' }, 'Все') as HTMLButtonElement;
  const filterDueBtn = el('button', { type: 'button' }, 'К повторению') as HTMLButtonElement;
  filterSeg.append(filterAllBtn, filterDueBtn);

  const toolbar = el('div', { class: 'folder-toolbar' }, [
    searchInput,
    filterSeg,
  ]);

  const listMount = el('div', { class: 'card-list' }, []);
  const emptyFilter = el('p', { class: 'folder-filter-empty muted hidden' }, 'Ничего не найдено');
  let virtualList: ReturnType<typeof createVirtualList> | null = null;

  /** Search haystack + display plains — stripHtml once per card load, not per keystroke. */
  let { hay: searchIndex, plains: displayPlain } = buildCardSearchIndex(cards);

  function buildFilteredItems(): ListItem[] {
    const q = searchInput.value.trim().toLowerCase();
    const items: ListItem[] = [];
    cards.forEach((c: SrsCard, i: number) => {
      if (filterMode === 'due' && !SRS.isReviewable(c, algo, now)) return;
      if (!matchesSearchIndex(searchIndex, c.id, q)) return;
      const plains = displayPlain.get(c.id || '') || { front: '', back: '' };
      items.push({ card: c, i, frontPlain: plains.front, backPlain: plains.back });
    });
    return items;
  }

  function updateEmptyState(shown: number) {
    emptyFilter.classList.toggle('hidden', shown > 0 || !cards.length);
    if (shown === 0 && cards.length && (searchInput.value.trim() || filterMode === 'due')) {
      emptyFilter.textContent = filterMode === 'due' && !searchInput.value.trim()
        ? 'Сейчас нет карточек к повторению'
        : 'Ничего не найдено';
    }
  }

  function paintListPlain(items: ListItem[]) {
    listMount.innerHTML = '';
    listMount.className = 'card-list';
    for (const item of items) {
      listMount.append(cardRow(item, algo, false));
    }
  }

  function paintListVirtual(items: ListItem[], scrollRoot: Element | null) {
    if (!virtualList) {
      virtualList = createVirtualList({
        scrollRoot: scrollRoot as HTMLElement,
        mount: listMount,
        items,
        rowHeight: DEFAULT_ROW_HEIGHT,
        gap: DEFAULT_GAP,
        renderRow: (item) => cardRow(item as ListItem, algo, true),
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
    paintListVirtual(items, scrollRoot as HTMLElement);
  }

  function setFilter(mode: string) {
    filterMode = mode;
    filterAllBtn.classList.toggle('active', mode === 'all');
    filterDueBtn.classList.toggle('active', mode === 'due');
    paintList();
  }

  async function removeCardLocally(cardId: string) {
    const snap = cards.find((c) => c.id === cardId);
    await store.deleteCard(cardId);
    cards = cards.filter((c) => c.id !== cardId);
    searchIndex.delete(cardId);
    displayPlain.delete(cardId);
    due = folderStudyDue(buildHomeStats(cards, algo, Date.now()).byFolder[folderId], newBudget());
    wrap.classList.toggle('is-empty', !cards.length);
    if (!cards.length) {
      toolbar.remove();
      listMount.remove();
      emptyFilter.remove();
      virtualList?.destroy();
      virtualList = null;
    } else {
      paintList();
    }
    if (snap) {
      offerUndoDeleteCard(snap, async () => {
        cards = (await store.getFolderCards(folderId)) as SrsCard[];
        const rebuilt = buildCardSearchIndex(cards);
        searchIndex = rebuilt.hay;
        displayPlain = rebuilt.plains;
        wrap.classList.toggle('is-empty', !cards.length);
        if (cards.length && !toolbar.isConnected) {
          wrap.append(toolbar, listMount, emptyFilter);
        }
        paintList();
      });
    } else {
      toast('Карточка удалена');
    }
  }

  filterAllBtn.addEventListener('click', () => setFilter('all'));
  filterDueBtn.addEventListener('click', () => setFilter('due'));
  searchInput.addEventListener('input', debounce(() => paintList(), 180));

  const wrap = el('div', { class: 'folder-page' + (!cards.length ? ' is-empty' : '') }, []);
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
    requestAnimationFrame(() => virtualList!.refresh());
  }

  function cardRow(item: ListItem, algoName: Algo, virtual: boolean) {
    const c = item.card;
    const i = item.i;
    const img = c.front_img || c.back_img;
    let chip;
    if (SRS.isNew(c, algoName)) chip = el('span', { class: 'srs-chip new' }, 'новая');
    else if (SRS.isDue(c, algoName, now)) chip = el('span', { class: 'srs-chip due' }, 'пора');
    else {
      const d = SRS.dueOf(c, algoName);
      chip = el('span', { class: 'srs-chip' }, 'через ' + SRS.fmtDays(Math.max(1, Math.round(((d ?? Date.now()) - Date.now()) / 86400000))));
    }
    const rowClass = virtual ? 'card-row' : 'card-row stagger-in';
    const rowStyle = virtual ? null : { '--stagger-delay': Math.min(i * 30, 400) + 'ms' };
    const row = el('div', {
      class: rowClass,
      style: rowStyle,
      onclick: () => cardDialog(c.folder_id ?? "", c),
    }, [
      img ? el('img', {
        class: 'thumb',
        src: img,
        alt: '',
        loading: virtual ? 'lazy' : 'eager',
        decoding: 'async',
      }) : null,
      el('div', { class: 'texts' }, [
        el('div', { class: 'front' }, item.frontPlain || '(картинка)'),
        el('div', { class: 'back' }, item.backPlain || ''),
      ]),
      chip,
      el('button', {
        class: 'icon-btn', title: 'Удалить',
        onclick: async e => {
          e.stopPropagation();
          const yes = await confirmDialog('Удалить карточку?', textPreview(c), 'Удалить', true, crowTombIcon());
          if (!yes) return;
          row.classList.add('removing');
          setTimeout(() => {
            if (c.id) void removeCardLocally(c.id);
          }, 250);
        },
      }, svgNode(ICONS.trash)),
    ]);
    return row;
  }
}
