import { el, toast, spinner } from '../../ui/ui.js';
import { store } from '../../core/state.js';

export function imgDrop(side, state) {
  const box = el('div', {
    class: 'img-drop', tabindex: '0', role: 'button',
    'aria-label': 'Добавить картинку: клик — выбрать файл, Ctrl+V — вставить из буфера обмена',
  });
  const input = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });

  function paint() {
    box.innerHTML = '';
    if (state[side]) {
      box.append(
        el('img', { src: state[side], alt: '' }),
        el('button', {
          type: 'button', class: 'img-x', title: 'Убрать картинку',
          onclick: e => { e.stopPropagation(); state[side] = null; paint(); },
        }, '✕')
      );
    } else {
      box.append(
        el('span', null, '+ Картинка'),
        el('span', { class: 'img-drop-hint' }, 'или Ctrl+V'),
        input,
      );
    }
  }

  async function handleFile(file) {
    if (!file || !String(file.type || '').startsWith('image/')) return;
    box.innerHTML = '';
    box.append(spinner());
    try { state[side] = await store.uploadImage(file); }
    catch (e) { toast(e.message, 'error'); }
    paint();
  }

  function pasteImageFromClipboard(clipboardData) {
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
  input.addEventListener('change', () => handleFile(input.files[0]));
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', e => {
    e.preventDefault(); box.classList.remove('drag');
    handleFile(e.dataTransfer.files[0]);
  });
  paint();
  return box;
}
