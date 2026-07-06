import { el, toast, spinner } from '../../ui/ui.js';
import { store } from '../../core/state.js';

export function imgDrop(side, state) {
  const box = el('div', { class: 'img-drop' });
  const input = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });

  function paint() {
    box.innerHTML = '';
    if (state[side]) {
      box.append(
        el('img', { src: state[side], alt: '' }),
        el('button', {
          class: 'img-x', title: 'Убрать картинку',
          onclick: e => { e.stopPropagation(); state[side] = null; paint(); },
        }, '✕')
      );
    } else {
      box.append(el('span', null, '+ Картинка'), input);
    }
  }

  async function handleFile(file) {
    if (!file) return;
    box.innerHTML = '';
    box.append(spinner());
    try { state[side] = await store.uploadImage(file); }
    catch (e) { toast(e.message, 'error'); }
    paint();
  }

  box.addEventListener('click', () => { if (!state[side]) input.click(); });
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
