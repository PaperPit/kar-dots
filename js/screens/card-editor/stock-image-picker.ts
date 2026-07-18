import { el, modal, spinner, toast } from '../../ui/ui.js';
import { searchStockMedia, downloadStockMedia } from '../../lib/stock-media.js';
import { hasGiphyApiKey, hasPixabayApiKey } from '../../lib/stock-media-settings.js';

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function providerLabel(meta) {
  if (meta?.provider === 'pixabay') return 'Pixabay';
  if (meta?.provider === 'giphy') return 'Giphy';
  if (meta?.fallback) return 'Openverse (базовый)';
  return '';
}

const TAB_DEFS = [
  { type: 'photo', label: 'Фото' },
  { type: 'illustration', label: 'Иллюстрации' },
  { type: 'gif', label: 'GIF' },
  { type: 'sticker', label: 'Стикеры' },
];

export function openStockImagePicker({ initialQuery = '', onSelect, getSettings } = {}) {
  let page = 1;
  let type = 'photo';
  let lastQuery = '';
  let loading = false;
  let pageCount = 0;

  const titleId = 'stock-picker-title';
  const searchInput = el('input', {
    type: 'search',
    class: 'input stock-search-input',
    placeholder: 'Слово на русском или английском…',
    autocomplete: 'off',
    value: initialQuery,
  });

  const tabBtns = TAB_DEFS.map(def => el('button', {
    type: 'button',
    class: 'btn stock-tab' + (def.type === 'photo' ? ' is-active' : ''),
    'data-type': def.type,
  }, def.label));
  const tabs = el('div', { class: 'stock-tabs' }, tabBtns);

  const statusEl = el('p', { class: 'stock-status', hidden: true });
  const translateHintEl = el('p', { class: 'stock-translate-hint', hidden: true });
  const providerHintEl = el('p', { class: 'stock-provider-hint muted', hidden: true });
  const grid = el('div', { class: 'stock-grid', role: 'list' });
  const attrEl = el('p', { class: 'stock-attribution', hidden: true });
  const prevBtn = el('button', { type: 'button', class: 'btn secondary stock-page-btn', disabled: true }, '←');
  const nextBtn = el('button', { type: 'button', class: 'btn secondary stock-page-btn', disabled: true }, '→');
  const pageInfo = el('span', { class: 'stock-page-info' }, '');
  const pager = el('div', { class: 'stock-pager', hidden: true }, [prevBtn, pageInfo, nextBtn]);

  function settings() {
    return getSettings?.() || {};
  }

  function updateProviderHint() {
    const s = settings();
    const hasKey = (type === 'gif' || type === 'sticker')
      ? hasGiphyApiKey(s)
      : hasPixabayApiKey(s);
    providerHintEl.hidden = hasKey;
    if (!hasKey) {
      providerHintEl.textContent = (type === 'gif' || type === 'sticker')
        ? 'Без Giphy ключа — базовый Openverse. Настройки → Картинки для карточек.'
        : 'Без Pixabay ключа — базовый Openverse. Настройки → Картинки для карточек.';
    }
  }

  function setTab(nextType) {
    if (type === nextType) return;
    type = nextType;
    page = 1;
    tabBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.type === type);
    });
    translateHintEl.hidden = true;
    attrEl.hidden = true;
    updateProviderHint();
    runSearch();
  }

  function setLoading(on, message = 'Ищем…') {
    loading = on;
    searchInput.disabled = on;
    tabBtns.forEach(btn => { btn.disabled = on; });
    prevBtn.disabled = on || page <= 1;
    nextBtn.disabled = on || page >= pageCount;
    if (on) {
      statusEl.hidden = false;
      statusEl.textContent = message;
      grid.replaceChildren(spinner());
      attrEl.hidden = true;
    }
  }

  function badgeFor(item) {
    if (item.isSticker) return el('span', { class: 'stock-thumb-badge' }, 'ST');
    if (item.isGif) return el('span', { class: 'stock-thumb-badge' }, 'GIF');
    return null;
  }

  function renderItems(items) {
    grid.innerHTML = '';
    if (!items.length) {
      statusEl.hidden = false;
      statusEl.textContent = lastQuery
        ? 'Ничего не найдено — попробуйте другой запрос'
        : 'Введите слово для поиска';
      pager.hidden = true;
      return;
    }
    statusEl.hidden = true;
    pager.hidden = pageCount <= 1;
    pageInfo.textContent = `${page} / ${pageCount}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= pageCount;

    for (const item of items) {
      const img = el('img', {
        src: item.thumb,
        alt: item.title,
        loading: 'lazy',
        decoding: 'async',
        referrerpolicy: 'no-referrer',
      });
      img.addEventListener('error', () => {
        if (img.dataset.fallback !== '1') {
          img.dataset.fallback = '1';
          img.src = item.url;
        }
      });

      const btn = el('button', {
        type: 'button',
        class: 'stock-thumb',
        role: 'listitem',
        title: item.title,
      }, [img, badgeFor(item)].filter(Boolean));

      btn.addEventListener('click', async () => {
        btn.disabled = true;
        grid.setAttribute('aria-busy', 'true');
        setLoading(true, 'Загружаем…');
        try {
          const file = await downloadStockMedia(item);
          onSelect?.(file, item);
          m.close();
        } catch (e) {
          toast(e.message, 'error');
          btn.disabled = false;
          grid.removeAttribute('aria-busy');
          renderItems(items);
        } finally {
          loading = false;
        }
      });

      btn.addEventListener('mouseenter', () => {
        if (item.attribution) {
          attrEl.hidden = false;
          attrEl.textContent = item.attribution;
        } else if (item.creator) {
          attrEl.hidden = false;
          attrEl.textContent = `Автор: ${item.creator}`;
        } else {
          attrEl.hidden = true;
        }
      });

      grid.append(btn);
    }
  }

  async function runSearch() {
    const q = searchInput.value.trim();
    lastQuery = q;
    updateProviderHint();
    if (!q) {
      grid.innerHTML = '';
      statusEl.hidden = false;
      statusEl.textContent = 'Введите слово для поиска';
      pager.hidden = true;
      attrEl.hidden = true;
      return;
    }
    if (loading) return;
    setLoading(true, /[\u0400-\u04FF]/.test(q) ? 'Переводим и ищем…' : 'Ищем…');
    try {
      const data = await searchStockMedia({
        q, type, page, pageSize: 20, settings: settings(),
      });
      pageCount = Math.max(1, data.pageCount || 1);
      page = data.page || page;

      if (data.searchMeta?.error) {
        translateHintEl.hidden = false;
        translateHintEl.textContent = data.searchMeta.error;
      } else if (data.searchMeta?.translated) {
        translateHintEl.hidden = false;
        translateHintEl.textContent =
          `«${data.searchMeta.original}» → «${data.searchMeta.query}» · ${providerLabel(data.searchMeta)}`;
      } else if (data.searchMeta?.enriched && data.searchMeta.searchQuery !== data.searchMeta.query) {
        translateHintEl.hidden = false;
        translateHintEl.textContent =
          `«${data.searchMeta.query}» → «${data.searchMeta.searchQuery}» · ${providerLabel(data.searchMeta)}`;
      } else if (data.searchMeta?.provider && data.searchMeta.provider !== 'openverse') {
        translateHintEl.hidden = false;
        translateHintEl.textContent = providerLabel(data.searchMeta);
      } else if (data.searchMeta?.fallback) {
        translateHintEl.hidden = false;
        translateHintEl.textContent = 'Openverse (базовый)';
      } else {
        translateHintEl.hidden = true;
      }

      renderItems(data.items);
    } catch (e) {
      grid.innerHTML = '';
      statusEl.hidden = false;
      statusEl.textContent = e.message;
      pager.hidden = true;
    } finally {
      loading = false;
      searchInput.disabled = false;
      tabBtns.forEach(btn => { btn.disabled = false; });
    }
  }

  const debouncedSearch = debounce(() => { page = 1; runSearch(); }, 420);

  searchInput.addEventListener('input', debouncedSearch);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); page = 1; runSearch(); }
  });
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.type));
  });
  prevBtn.addEventListener('click', () => { if (page > 1) { page--; runSearch(); } });
  nextBtn.addEventListener('click', () => { if (page < pageCount) { page++; runSearch(); } });

  const body = el('div', { class: 'stock-picker' }, [
    el('p', { class: 'stock-picker-lead' },
      'Фото, иллюстрации, GIF и стикеры с открытых баз (Pixabay, Giphy, Openverse).'),
    el('div', { class: 'stock-search-row' }, [searchInput, tabs]),
    providerHintEl,
    translateHintEl,
    statusEl,
    grid,
    attrEl,
    pager,
    el('p', { class: 'stock-picker-note' },
      'Укажите бесплатные API-ключи в настройках для доступа к большим каталогам.'),
  ]);

  const m = modal(el('div', null, [
    el('h3', { class: 'modal-title', id: titleId }, 'Найти картинку'),
    body,
    el('div', { class: 'modal-actions modal-actions-center' }, [
      el('button', { type: 'button', class: 'btn secondary', onclick: () => m.close() }, 'Отмена'),
    ]),
  ]), { wide: true, labelledBy: titleId });

  updateProviderHint();
  setTimeout(() => {
    searchInput.focus();
    if (initialQuery.trim()) runSearch();
  }, 280);

  return m;
}
