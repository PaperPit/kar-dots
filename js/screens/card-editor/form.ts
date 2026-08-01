import { el } from '../../ui/ui.js';
import { richEditor } from '../../ui/rich-editor.js';
import { t } from '../../lib/i18n.js';
import { imgDrop } from './image-drop.js';
import type { Card } from '../../data/types.js';

interface CardEditorState {
  front_img?: string | null;
  back_img?: string | null;
  [key: string]: unknown;
}

export function buildCardEditorForm(card: Card | null, state: CardEditorState, translateRow: HTMLElement) {
  const frontRich = richEditor({
    placeholder: t('cardEditor.form.frontPlaceholder'),
    value: card ? card.front : '',
    toolbar: false,
  });

  const defRich = richEditor({
    placeholder: t('cardEditor.form.definitionPlaceholder'),
    value: card ? card.back : '',
    toolbar: false,
  });

  const descRich = richEditor({
    placeholder: t('cardEditor.form.descriptionPlaceholder'),
    value: card ? card.description : '',
    toolbarExternal: true,
  });

  const body = el('div', { class: 'editor-sides' }, [
    el('div', { class: 'side-box' }, [
      el('div', { class: 'side-title' }, t('cardEditor.form.frontLabel')),
      el('p', { class: 'field-hint' }, t('cardEditor.form.frontHint')),
      frontRich.node,
      imgDrop('front_img', state, { suggestQuery: () => frontRich.getPlain() }),
    ]),
    el('div', { class: 'side-box' }, [
      el('div', { class: 'side-title' }, t('cardEditor.form.backLabel')),
      el('div', { class: 'field' }, [
        el('label', null, t('cardEditor.form.definitionLabel')),
        translateRow,
        defRich.node,
      ]),
      el('div', { class: 'field' }, [
        el('div', { class: 'field-label-row' }, [
          el('label', null, t('cardEditor.form.descriptionLabel')),
          descRich.toolbar,
        ]),
        descRich.node,
      ]),
      imgDrop('back_img', state, { suggestQuery: () => defRich.getPlain() }),
    ]),
  ]);

  return { body, frontRich, defRich, descRich };
}
