import { el, toast, modal } from '../../ui/ui.js';
import { featherIcon } from '../../ui/helpers.js';
import { getTranslateDir, translateText } from '../../lib/translate.js';
import { createTranslateDirToggle } from '../../ui/translate-dir-toggle.js';
import { buildCardEditorForm } from './form.js';
import { saveCard, deleteCardAction } from './actions.js';
import { openCardPreview } from './card-preview.js';

export function cardDialog(folderId, card, opts = {}) {
  const isEditing = !!card;
  const fromLesson = !!(opts.review || opts.fromLesson || opts.onSaved || opts.onDeleted);
  const titleId = 'card-dialog-title';
  const state = {
    front_img: card ? card.front_img : null,
    back_img: card ? card.back_img : null,
  };

  let m;
  let saveBtn;
  let saveMoreBtn = null;
  const { btn: dirToggleBtn, getDir: getTranslateDirLocal } = createTranslateDirToggle(getTranslateDir());

  const translateBtn = el('button', { type: 'button', class: 'btn translate-btn' }, 'Перевести');
  const translateRow = el('div', { class: 'translate-row' }, [
    dirToggleBtn,
    translateBtn,
  ]);

  const { body, frontRich, defRich, descRich } = buildCardEditorForm(card, state, translateRow);

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

  function openNewDialog() {
    cardDialog(folderId);
  }

  async function submit(andContinue) {
    await saveCard({
      folderId, card, state, frontRich, defRich, descRich,
      fromLesson, opts, m, andContinue, saveBtn, saveMoreBtn, openNewDialog,
    });
  }

  saveBtn = el('button', {
    type: 'button',
    class: 'btn primary',
    onclick: () => submit(false),
  }, isEditing ? 'Сохранить' : 'Добавить');

  if (!isEditing && !fromLesson) {
    saveMoreBtn = el('button', {
      type: 'button',
      class: 'btn btn-save-more',
      title: 'Сохранить и добавить ещё одну карточку',
      onclick: () => submit(true),
    }, [
      el('span', { class: 'btn-save-more-short' }, 'Сохр. + ещё'),
      el('span', { class: 'btn-save-more-full' }, 'Сохр. + добавить ещё'),
    ]);
  }

  const deleteBtn = isEditing && fromLesson
    ? el('button', {
      type: 'button',
      class: 'btn danger modal-delete-btn',
      onclick: () => deleteCardAction(card, opts, m),
    }, 'Удалить')
    : null;

  const previewBtn = el('button', {
    type: 'button',
    class: 'btn card-preview-btn',
    onclick: () => openCardPreview({ frontRich, defRich, descRich, state }),
  }, 'Просмотр');

  const actionBtnsEnd = [
    el('button', { type: 'button', class: 'btn secondary', onclick: () => m.close() }, 'Отмена'),
  ];
  if (saveMoreBtn) actionBtnsEnd.push(saveMoreBtn);
  actionBtnsEnd.push(saveBtn);

  const actionsRow = el('div', { class: 'modal-actions modal-actions-split card-editor-actions' }, [
    previewBtn,
    el('div', { class: 'modal-actions-end' }, actionBtnsEnd),
  ]);

  const header = isEditing
    ? el('div', { class: 'modal-head modal-head-toolbar' }, [
      el('div', { class: 'modal-head-left' }, [
        featherIcon('modal-head-icon'),
        el('h3', { class: 'modal-title', id: titleId }, 'Карточка'),
      ]),
      deleteBtn,
    ].filter(Boolean))
    : el('h3', { class: 'modal-title', id: titleId }, 'Новая карточка');

  m = modal(el('div', null, [
    header,
    body,
    actionsRow,
  ]), { wide: true, sticky: fromLesson, labelledBy: titleId });

  if (!isEditing) setTimeout(() => frontRich.focus(), 260);
}
