import { el, modal, toast, stripHtml } from '../../ui/ui.js';
import { store } from '../../core/state.js';
import { createFlipCard } from '../review/flip-card.js';

function previewPromptSide() {
  const dir = store.settings?.direction || 'ftb';
  if (dir === 'btf') return 'back';
  return 'front';
}

function buildPreviewCard({ frontRich, defRich, descRich, state }) {
  return {
    id: 'preview-draft',
    front: frontRich.getHTML(),
    back: defRich.getHTML(),
    description: descRich.isEmpty() ? '' : descRich.getHTML(),
    front_img: state.front_img || null,
    back_img: state.back_img || null,
  };
}

export function openCardPreview(ctx) {
  const { frontRich, defRich, descRich, state } = ctx;
  const frontText = stripHtml(frontRich.getHTML()).trim();
  const backText = stripHtml(defRich.getHTML()).trim();
  const descText = stripHtml(descRich.getHTML()).trim();

  if (!frontText && !state.front_img) {
    toast('Заполните лицевую сторону для просмотра', 'error');
    return;
  }
  if (!backText && !descText && !state.back_img) {
    toast('Заполните оборот для просмотра', 'error');
    return;
  }

  const card = buildPreviewCard(ctx);
  const promptSide = previewPromptSide();
  const { box, grades } = createFlipCard(card, promptSide, {});

  grades.hidden = true;
  grades.replaceChildren();

  const wrap = el('div', { class: 'card-preview-wrap' }, [box]);

  let pm;
  pm = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, 'Просмотр карточки'),
    el('p', { class: 'modal-text muted card-preview-lead' },
      'Как в режиме повторения — нажмите на карточку, чтобы перевернуть.'),
    wrap,
    el('div', { class: 'modal-actions modal-actions-center' }, [
      el('button', { type: 'button', class: 'btn primary', onclick: () => pm.close() }, 'Закрыть'),
    ]),
  ]), { wide: true });
}
