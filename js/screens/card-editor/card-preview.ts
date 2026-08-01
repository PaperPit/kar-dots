import { el, modal, toast, stripHtml } from '../../ui/ui.js';
import type { ModalHandle } from '../../ui/ui.js';
import { store } from '../../core/state.js';
import { t } from '../../lib/i18n.js';
import { createFlipCard, sizeFlipCard } from '../review/flip-card.js';

interface RichTextEditor {
  getHTML(): string;
  isEmpty(): boolean;
}

interface CardEditorState {
  front_img?: string | null;
  back_img?: string | null;
  [key: string]: unknown;
}

interface PreviewCtx {
  frontRich: RichTextEditor;
  defRich: RichTextEditor;
  descRich: RichTextEditor;
  state: CardEditorState;
}

function previewPromptSide() {
  const dir = store.settings?.direction || 'ftb';
  if (dir === 'btf') return 'back';
  return 'front';
}

function buildPreviewCard({ frontRich, defRich, descRich, state }: PreviewCtx) {
  return {
    id: 'preview-draft',
    front: frontRich.getHTML(),
    back: defRich.getHTML(),
    description: descRich.isEmpty() ? '' : descRich.getHTML(),
    front_img: state.front_img ?? undefined,
    back_img: state.back_img ?? undefined,
  };
}

export function openCardPreview(ctx: PreviewCtx) {
  const { frontRich, defRich, descRich, state } = ctx;
  const frontText = stripHtml(frontRich.getHTML()).trim();
  const backText = stripHtml(defRich.getHTML()).trim();
  const descText = stripHtml(descRich.getHTML()).trim();

  if (!frontText && !state.front_img) {
    toast(t('cardEditor.preview.needFront'), 'error');
    return;
  }
  if (!backText && !descText && !state.back_img) {
    toast(t('cardEditor.preview.needBack'), 'error');
    return;
  }

  const card = buildPreviewCard(ctx);
  const promptSide = previewPromptSide();
  const { box, flip, grades, destroy } = createFlipCard(card, promptSide, {});

  grades.hidden = true;
  grades.replaceChildren();

  const wrap = el('div', { class: 'card-preview-wrap' }, [box]);

  let pm: ModalHandle;
  pm = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, t('cardEditor.preview.title')),
    el('p', { class: 'modal-text muted card-preview-lead' },
      t('cardEditor.preview.lead')),
    wrap,
    el('div', { class: 'modal-actions modal-actions-center' }, [
      el('button', { type: 'button', class: 'btn primary', onclick: () => pm.close() }, t('cardEditor.preview.close')),
    ]),
  ]), { wide: true, onClose: destroy });

  // После открытия модалки высота известна — подогнать фото под окно просмотра.
  requestAnimationFrame(() => {
    sizeFlipCard(flip);
    requestAnimationFrame(() => sizeFlipCard(flip));
  });
}
