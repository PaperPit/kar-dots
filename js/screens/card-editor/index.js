import { store } from '../../core/state.js';
import { el, toast, modal, spinner } from '../../ui/ui.js';
import { richEditor } from '../../ui/rich-editor.js';
import { descriptionPlain } from '../../ui/card-face.js';
import { svgNode } from '../../ui/helpers.js';
import { route } from '../../core/router.js';

function imgDrop(side, state) {
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

export function cardDialog(folderId, card) {
  const state = {
    front_img: card ? card.front_img : null,
    back_img: card ? card.back_img : null,
  };

  const frontRich = richEditor({
    placeholder: 'Слово или термин',
    value: card ? card.front : '',
  });

  const defRich = richEditor({
    placeholder: 'Краткое определение',
    value: card ? card.back : '',
  });

  const descInput = el('textarea', {
    class: 'input desc-input',
    rows: 4,
    placeholder: 'Подробное описание (необязательно) — показывается на обороте под определением',
  });
  descInput.value = card ? descriptionPlain(card) : '';

  let m;
  const save = el('button', {
    class: 'btn primary',
    onclick: async () => {
      const front = frontRich.getHTML();
      const back = defRich.getHTML();
      const description = descInput.value.trim();
      if (frontRich.isEmpty() && !state.front_img) {
        toast('Заполните лицевую сторону', 'error');
        return;
      }
      if (defRich.isEmpty() && !description && !state.back_img) {
        toast('Заполните определение или описание на обороте', 'error');
        return;
      }
      save.disabled = true;
      try {
        const patch = {
          front, back, description,
          front_img: state.front_img, back_img: state.back_img,
        };
        if (card) await store.updateCard(card.id, patch);
        else await store.createCard(Object.assign({ folder_id: folderId }, patch));
        m.close();
        await route();
        if (!card) toast('Карточка добавлена', 'ok');
      } catch (e) {
        toast(e.message, 'error');
        save.disabled = false;
      }
    },
  }, card ? 'Сохранить' : 'Добавить');

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, card ? 'Карточка' : 'Новая карточка'),
    el('div', { class: 'editor-sides' }, [
      el('div', { class: 'side-box' }, [
        el('div', { class: 'side-title' }, 'Лицо'),
        el('p', { class: 'field-hint' }, 'Только слово или термин'),
        frontRich.node,
        imgDrop('front_img', state),
      ]),
      el('div', { class: 'side-box' }, [
        el('div', { class: 'side-title' }, 'Оборот'),
        el('div', { class: 'field' }, [
          el('label', null, 'Определение'),
          defRich.node,
        ]),
        el('div', { class: 'field' }, [
          el('label', null, 'Описание'),
          descInput,
        ]),
        imgDrop('back_img', state),
      ]),
    ]),
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      save,
    ]),
  ]), { wide: true });

  if (!card) setTimeout(() => frontRich.focus(), 260);
}
