import { el } from '../../ui/ui.js';
import { richEditor } from '../../ui/rich-editor.js';
import { imgDrop } from './image-drop.js';

export function buildCardEditorForm(card, state, translateRow) {
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
    placeholder: 'Показывается на обороте под определением',
    value: card ? card.description : '',
    toolbarExternal: true,
  });

  const body = el('div', { class: 'editor-sides' }, [
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
        el('div', { class: 'field-label-row' }, [
          el('label', null, 'Описание'),
          descRich.toolbar,
        ]),
        descRich.node,
      ]),
      imgDrop('back_img', state),
    ]),
  ]);

  return { body, frontRich, defRich, descRich };
}
