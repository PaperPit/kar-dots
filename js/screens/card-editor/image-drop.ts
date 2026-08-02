import { el, toast, spinner } from '../../ui/ui.js';
import { store } from '../../core/state.js';
import { resolveImageUrl, resolveImageUrlSync } from '../../data/image-url.js';
import { t } from '../../lib/i18n.js';
import { openStockImagePicker } from './stock-image-picker.js';

interface CardEditorState {
  front_img?: string | null;
  back_img?: string | null;
  [key: string]: unknown;
}

interface ImgDropOpts {
  suggestQuery?: () => string;
}

export function imgDrop(side: string, state: CardEditorState, opts: ImgDropOpts = {}) {
  /* region, не button: внутри живут кнопки удаления / стока */
  const box = el('div', {
    class: 'img-drop',
    tabindex: '0',
    role: 'group',
    'aria-label': t('cardEditor.image.dropAria'),
  }, undefined);
  const input = el('input', { type: 'file', accept: 'image/*', class: 'hidden' }, undefined);

  function paint() {
    box.innerHTML = '';
    if (state[side]) {
      // В карточке лежит постоянная ссылка на storage, но бакет приватный —
      // показывать надо подписанную. Сначала рисуем то, что есть под рукой
      // (свежая подпись из кэша, data:-URL после офлайн-загрузки), а подпись
      // подставляем, когда она приедет: иначе картинка мигала бы пустотой.
      const raw = state[side] as string;
      const img = el('img', { src: resolveImageUrlSync(raw), alt: '' }, undefined);
      void resolveImageUrl(raw).then(url => {
        if (state[side] === raw && url && img.getAttribute('src') !== url) img.setAttribute('src', url);
      });
      box.append(
        img,
        el('button', {
          type: 'button',
          class: 'img-x',
          title: t('cardEditor.image.remove'),
          'aria-label': t('cardEditor.image.remove'),
          onclick: (e: Event) => { e.stopPropagation(); state[side] = null; paint(); },
        }, '✕')
      );
    } else {
      const findBtn = el('button', {
        type: 'button',
        class: 'btn secondary stock-find-btn',
        onclick: (e: Event) => {
          e.stopPropagation();
          openStockImagePicker({
            initialQuery: opts.suggestQuery?.() || '',
            getSettings: () => store.settings,
            onSelect: file => handleFile(file),
          });
        },
      }, t('cardEditor.image.findStock'));
      box.append(
        el('span', null, t('cardEditor.image.add')),
        el('span', { class: 'img-drop-hint' }, t('cardEditor.image.hint')),
        el('div', { class: 'img-drop-actions' }, [findBtn]),
        input,
      );
    }
  }

  async function handleFile(file: File) {
    if (!file || !String(file.type || '').startsWith('image/')) return;
    box.innerHTML = '';
    box.append(spinner());
    // side («front_img»/«back_img») нужен, чтобы отложенную офлайн-загрузку
    // можно было привязать к карточке, когда её создадут.
    try { state[side] = await store.uploadImage(file, { side }); }
    catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); }
    paint();
  }

  function pasteImageFromClipboard(clipboardData: DataTransfer | null) {
    const items = clipboardData?.items;
    if (!items) return false;
    for (const item of items) {
      if (item.kind === 'file' && String(item.type || '').startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { handleFile(file); return true; }
      }
    }
    return false;
  }

  box.addEventListener('click', () => { box.focus(); if (!state[side]) input.click(); });
  box.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !state[side]) { e.preventDefault(); input.click(); }
  });
  box.addEventListener('paste', e => {
    if (pasteImageFromClipboard(e.clipboardData)) e.preventDefault();
  });
  input.addEventListener('change', () => { const f = input.files?.[0]; if (f) handleFile(f); });
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', e => {
    e.preventDefault(); box.classList.remove('drag');
    const f = e.dataTransfer?.files[0];
    if (f) handleFile(f);
  });
  paint();
  return box;
}
