import { store } from '../../core/state.js';
import { el, toast, modal, spinner, stripHtml, confirmDialog } from '../../ui/ui.js';
import { richEditor } from '../../ui/rich-editor.js';
import { featherIcon, modalHead, crowTombIcon, textPreview } from '../../ui/helpers.js';
import { route } from '../../core/router.js';
import { getTranslateDir, translateText } from '../../lib/translate.js';
import { createTranslateDirToggle } from '../../ui/translate-dir-toggle.js';

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

export function cardDialog(folderId, card, opts = {}) {
  const isEditing = !!card;
  const fromLesson = !!(opts.review || opts.fromLesson || opts.onSaved || opts.onDeleted);
  const state = {
    front_img: card ? card.front_img : null,
    back_img: card ? card.back_img : null,
  };

  const frontRich = richEditor({
    placeholder: 'Слово или термин',
    value: card ? card.front : '',
    toolbar: false,
  });

  const defRich = richEditor({
    placeholder: 'Краткое определение',
    value: card ? card.back : '',
    toolbar: false,
  });

  const descRich = richEditor({
    placeholder: 'Подробное описание (необязательно) — показывается на обороте под определением',
    value: card ? card.description : '',
  });

  let m;
  let saveBtn;
  let saveMoreBtn = null;
  const { btn: dirToggleBtn, getDir: getTranslateDirLocal } = createTranslateDirToggle(getTranslateDir());

  const translateBtn = el('button', { type: 'button', class: 'btn translate-btn' }, 'Перевести');

  translateBtn.addEventListener('click', async () => {
    const src = frontRich.getPlain();
    if (!src) { toast('Сначала введите слово на лицевой стороне', 'error'); return; }
    if (card && !defRich.isEmpty()) {
      if (!window.confirm('Заменить текущее определение переводом?')) return;
    }
    translateBtn.disabled = true;
    const prev = translateBtn.textContent;
    translateBtn.textContent = '…';
    try {
      const out = await translateText(src, getTranslateDirLocal());
      defRich.setPlain(out);
      toast('Перевод подставлен', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      translateBtn.disabled = false;
      translateBtn.textContent = prev;
    }
  });

  async function submit(andContinue) {
    const front = stripHtml(frontRich.getHTML()).trim();
    const back = stripHtml(defRich.getHTML()).trim();
    const description = descRich.isEmpty() ? '' : descRich.getHTML();
    if (frontRich.isEmpty() && !state.front_img) {
      toast('Заполните лицевую сторону', 'error');
      return;
    }
    if (defRich.isEmpty() && descRich.isEmpty() && !state.back_img) {
      toast('Заполните определение или описание на обороте', 'error');
      return;
    }
    saveBtn.disabled = true;
    if (saveMoreBtn) saveMoreBtn.disabled = true;
    try {
      const patch = {
        front, back, description,
        front_img: state.front_img, back_img: state.back_img,
      };
      if (card) await store.updateCard(card.id, patch);
      else await store.createCard(Object.assign({ folder_id: folderId }, patch));
      m.close();
      if (fromLesson) {
        opts.onSaved?.(patch);
        return;
      }
      await route();
      if (andContinue) {
        cardDialog(folderId);
        toast('Карточка добавлена', 'ok');
      } else if (!card) {
        toast('Карточка добавлена', 'ok');
      }
    } catch (e) {
      toast(e.message, 'error');
      saveBtn.disabled = false;
      if (saveMoreBtn) saveMoreBtn.disabled = false;
    }
  }

  saveBtn = el('button', {
    class: 'btn primary',
    onclick: () => submit(false),
  }, isEditing ? 'Сохранить' : 'Добавить');

  if (!isEditing && !fromLesson) {
    saveMoreBtn = el('button', {
      class: 'btn btn-save-more',
      title: 'Сохранить и добавить ещё одну карточку',
      onclick: () => submit(true),
    }, [
      el('span', { class: 'btn-save-more-short' }, 'Сохр. + ещё'),
      el('span', { class: 'btn-save-more-full' }, 'Сохр. + добавить ещё'),
    ]);
  }

  async function deleteCard() {
    if (!card) return;
    const yes = await confirmDialog(
      'Удалить карточку?',
      textPreview(card),
      'Удалить',
      true,
      crowTombIcon(),
    );
    if (!yes) return;
    try {
      await store.deleteCard(card.id);
      m.close();
      if (opts.onDeleted) {
        opts.onDeleted();
        return;
      }
      await route();
      toast('Карточка удалена', 'ok');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const deleteBtn = isEditing && fromLesson
    ? el('button', {
      type: 'button',
      class: 'btn danger modal-delete-btn',
      onclick: () => deleteCard(),
    }, 'Удалить')
    : null;

  const actionBtns = [
    el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
  ];
  if (saveMoreBtn) actionBtns.push(saveMoreBtn);
  actionBtns.push(saveBtn);

  const actionsRow = deleteBtn
    ? el('div', { class: 'modal-actions modal-actions-split' }, [
      deleteBtn,
      el('div', { class: 'modal-actions-end' }, actionBtns),
    ])
    : el('div', { class: 'modal-actions' }, actionBtns);

  const translateRow = el('div', { class: 'translate-row' }, [
    dirToggleBtn,
    translateBtn,
  ]);

  m = modal(el('div', null, [
    isEditing ? modalHead('Карточка', featherIcon('modal-head-icon')) : el('h3', { class: 'modal-title' }, 'Новая карточка'),
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
          translateRow,
          defRich.node,
        ]),
        el('div', { class: 'field' }, [
          el('label', null, 'Описание'),
          descRich.node,
        ]),
        imgDrop('back_img', state),
      ]),
    ]),
    actionsRow,
  ]), { wide: true, sticky: fromLesson });

  if (!isEditing) setTimeout(() => frontRich.focus(), 260);
}
