import { store } from '../../core/state.js';
import { toast, stripHtml, confirmDialog } from '../../ui/ui.js';
import { crowTombIcon, textPreview } from '../../ui/helpers.js';
import { route } from '../../core/router.js';
import { t } from '../../lib/i18n.js';
import type { Card } from '../../data/types.js';
import type { ModalHandle } from '../../ui/ui.js';

interface RichTextEditor {
  getHTML(): string;
  isEmpty(): boolean;
}

interface CardEditorState {
  front_img?: string | null;
  back_img?: string | null;
  [key: string]: unknown;
}

interface SaveCardOpts {
  onSaved?: (patch: Record<string, unknown>) => void;
}

interface DeleteCardOpts {
  onDeleted?: () => void;
}

export async function saveCard({
  folderId, card, state, frontRich, defRich, descRich,
  fromLesson, opts, m, andContinue, saveBtn, saveMoreBtn, openNewDialog,
}: {
  folderId: string;
  card: Card | null;
  state: CardEditorState;
  frontRich: RichTextEditor;
  defRich: RichTextEditor;
  descRich: RichTextEditor;
  fromLesson: boolean;
  opts: SaveCardOpts;
  m: ModalHandle;
  andContinue: boolean;
  saveBtn: HTMLButtonElement;
  saveMoreBtn: HTMLButtonElement | null;
  openNewDialog: () => void;
}) {
  const front = stripHtml(frontRich.getHTML()).trim();
  const back = stripHtml(defRich.getHTML()).trim();
  const description = descRich.isEmpty() ? '' : descRich.getHTML();
  if (frontRich.isEmpty() && !state.front_img) {
    toast(t('cardEditor.validation.needFront'), 'error');
    return;
  }
  if (defRich.isEmpty() && descRich.isEmpty() && !state.back_img) {
    toast(t('cardEditor.validation.needBack'), 'error');
    return;
  }
  saveBtn.disabled = true;
  if (saveMoreBtn) saveMoreBtn.disabled = true;
  try {
    const patch = {
      front, back, description,
      front_img: state.front_img, back_img: state.back_img,
    };
    if (card?.id) await store.updateCard(card.id, patch);
    else await store.createCard(Object.assign({ folder_id: folderId }, patch));
    m.close();
    if (fromLesson) {
      opts.onSaved?.(patch);
      return;
    }
    await route();
    if (andContinue) {
      openNewDialog();
      toast(t('cardEditor.toast.added'), 'ok');
    } else if (!card) {
      toast(t('cardEditor.toast.added'), 'ok');
    }
  } catch (e) {
    const err = e as Error;
    toast(err.message, 'error');
    saveBtn.disabled = false;
    if (saveMoreBtn) saveMoreBtn.disabled = false;
  }
}

export async function deleteCardAction(card: Card | null, opts: DeleteCardOpts, m: ModalHandle) {
  if (!card) return;
  const yes = await confirmDialog(
    t('cardEditor.confirm.deleteTitle'),
    textPreview(card),
    t('common.delete'),
    true,
    crowTombIcon(),
  );
  if (!yes) return;
  try {
    if (card.id) await store.deleteCard(card.id);
    m.close();
    if (opts.onDeleted) {
      opts.onDeleted();
      return;
    }
    await route();
    toast(t('cardEditor.toast.deleted'), 'ok');
  } catch (e) {
    const err = e as Error;
    toast(err.message, 'error');
  }
}
