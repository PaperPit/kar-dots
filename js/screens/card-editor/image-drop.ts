import { el, toast, spinner } from '../../ui/ui.js';
import { store } from '../../core/state.js';
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
  const box = el('div', {
    class: 'img-drop', tabindex: '0', role: 'button',
    'aria-label': 'Добавить картинку: клик — выбрать файл, Ctrl+V — вставить из буфера обмена',
  }, undefined);
  const input = el('input', { type: 'file', accept: 'image/*', class: 'hidden' }, undefined);

  function paint() {
    box.innerHTML = '';
    if (state[side]) {
      box.append(
        el('img', { src: (state[side] as string) ?? '', alt: '' }, undefined),
        el('button', {
          type: 'button', class: 'img-x', title: 'Убрать картинку',
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
      }, 'Найти сток');
      box.append(
        el('span', null, '+ Картинка'),
        el('span', { class: 'img-drop-hint' }, 'файл, Ctrl+V или сток'),
        el('div', { class: 'img-drop-actions' }, [findBtn]),
        input,
      );
    }
  }

  async function handleFile(file: File) {
    if (!file || !String(file.type || '').startsWith('image/')) return;
    box.innerHTML = '';
    box.append(spinner());
    try { state[side] = await store.uploadImage(file); }
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
