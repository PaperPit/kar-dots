import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import type { SrsCard, Algo } from '../../lib/srs.js';
import type { Folder } from '../../data/types.js';
import { el, toast, confirmDialog, stripHtml, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowTombIcon, debounce, featherIcon, folderSwatch, newBudget, svgNode, textPreview } from '../../ui/helpers.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { folderDialog } from '../home/folder-dialog.js';
import { cardDialog } from '../card-editor/index.js';
import { bulkCardDialog } from '../card-editor/bulk-dialog.js';
import { youtubeImportDialog } from './youtube-dialog.js';
import { studyModePicker } from '../review/mode-picker.js';
import { isVocabPackFolder } from '../../lib/vocab-packs.js';
import { route } from '../../core/router.js';
import { createVirtualList, VIRTUAL_LIST_THRESHOLD } from '../../lib/virtual-list.js';
import { buildHomeStats, folderStudyDue } from '../../data/home-stats.js';
import { resolveImageUrl, resolveImageUrlSync } from '../../data/image-url.js';

/**
 * Запасные метрики строки — только на первый кадр, пока в DOM нечего мерить.
 * Реальные берутся из `measureCardRow` (десктоп ~70px, мобильные ~66px).
 */
const CARD_ROW_HEIGHT = 70;
const CARD_ROW_GAP = 10;
/** Пауза перед фильтрацией: не пересобираем список на каждую букву. */
const SEARCH_DEBOUNCE_MS = 200;

/** Высота реальной строки и зазор списка — из вёрстки, а не из констант. */
function measureCardRow(windowEl: HTMLElement) {
  const row = windowEl.querySelector('.card-row');
  if (!row) return null;
  return {
    rowHeight: row.getBoundingClientRect().height,
    gap: parseFloat(getComputedStyle(windowEl).rowGap),
  };
}

function matchesSearch(card: SrsCard, query: string) {
  if (!query) return true;
  const hay = [
    stripHtml(card.front),
    stripHtml(card.back),
    stripHtml(card.description || ''),
  ].join(' ').toLowerCase();
  return hay.includes(query.toLowerCase());
}

export async function renderFolder(folderId: string) {
  const folder = (store.folders as Folder[]).find(f => f.id === folderId);
  if (!folder) { nav('#home'); return; }

  const cards = await store.getFolderCards(folderId) as SrsCard[];
  const algo = store.settings.algo as Algo;
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

  function buildFilteredItems() {
    const q = searchInput.value.trim();
    const items: { card: SrsCard; i: number }[] = [];
    cards.forEach((c: SrsCard, i: number) => {
      if (filterMode === 'due' && !SRS.isReviewable(c, algo, now)) return;
      if (!matchesSearch(c, q)) return;
      items.push({ card: c, i });
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

  function paintListPlain(items: { card: SrsCard; i: number }[]) {
    listMount.innerHTML = '';
    listMount.className = 'card-list';
    for (const { card, i } of items) {
      listMount.append(cardRow(card, i, algo, false));
    }
  }

  function paintListVirtual(items: { card: SrsCard; i: number }[], scrollRoot: Element | null) {
    if (!virtualList) {
      virtualList = createVirtualList({
        scrollRoot: scrollRoot as HTMLElement,
        mount: listMount,
        items,
        rowHeight: CARD_ROW_HEIGHT,
        gap: CARD_ROW_GAP,
        renderRow: ({ card, i }) => cardRow(card, i, algo, true),
        measure: measureCardRow,
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

  filterAllBtn.addEventListener('click', () => setFilter('all'));
  filterDueBtn.addEventListener('click', () => setFilter('due'));
  const debouncedPaint = debounce(() => paintList(), SEARCH_DEBOUNCE_MS);
  searchInput.addEventListener('input', debouncedPaint);
  // Enter — показать результат сразу, не дожидаясь паузы.
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); paintList(); }
  });

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

  /**
   * Миниатюра строки. Бакет card-images приватный, поэтому исходную ссылку
   * подменяем на подписанную. Строка виртуального списка переиспользуется под
   * другую карточку, поэтому перед подменой сверяем data-card-id.
   */
  function thumbImage(src: string, cardId: string | undefined, virtual: boolean): HTMLElement {
    const node = el('img', {
      class: 'thumb',
      src: resolveImageUrlSync(src),
      alt: '',
      'data-card-id': cardId ?? '',
      loading: virtual ? 'lazy' : 'eager',
      decoding: 'async',
    });
    void resolveImageUrl(src).then(url => {
      if (!url || node.getAttribute('data-card-id') !== (cardId ?? '')) return;
      if (node.getAttribute('src') !== url) node.setAttribute('src', url);
    });
    return node;
  }

  function cardRow(c: SrsCard, i: number, algoName: Algo, virtual: boolean) {
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
    // Открытие карточки — настоящая кнопка на тексте: доступна с клавиатуры и
    // читается скринридером. Её ::after растянут на всю строку, поэтому клик
    // мимо текста работает как раньше, а вид строки не меняется.
    const openBtn = el('button', {
      type: 'button',
      class: 'texts card-row-open',
      onclick: () => cardDialog(c.folder_id ?? "", c),
    }, [
      el('div', { class: 'front' }, stripHtml(c.front) || '(картинка)'),
      el('div', { class: 'back' }, stripHtml(c.back) || ''),
    ]);
    const row = el('div', {
      class: rowClass,
      style: rowStyle,
    }, [
      img ? thumbImage(img, c.id, virtual) : null,
      openBtn,
      chip,
      el('button', {
        type: 'button',
        class: 'icon-btn card-row-del',
        title: 'Удалить',
        'aria-label': 'Удалить карточку: ' + (stripHtml(c.front) || 'без текста'),
        onclick: async e => {
          e.stopPropagation();
          const yes = await confirmDialog('Удалить карточку?', textPreview(c), 'Удалить', true, crowTombIcon());
          if (!yes) return;
          row.classList.add('removing');
          setTimeout(async () => {
            if (c.id) await store.deleteCard(c.id);
            await route();
            toast('Карточка удалена');
          }, 250);
        },
      }, svgNode(ICONS.trash)),
    ]);
    return row;
  }
}
