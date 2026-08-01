import { store } from '../../core/state.js';
import { el, toast, confirmDialog, stripHtml } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { debounce } from '../../ui/helpers.js';
import { ICONS } from '../../ui/constants.js';
import { svgNode } from '../../ui/helpers.js';
import { renderMarkdown, noteTitleFromBody } from '../../lib/markdown.js';
import { t } from '../../lib/i18n.js';
import type { Note, Card } from '../../data/types.js';

const SAVE_MS = 500;

export async function renderNote(noteId: string) {
  const note = await store.getNote(noteId) as Note | null;
  if (!note) {
    toast(t('notes.toast.missing'), 'error');
    nav('#notes');
    return;
  }

  let previewMode = false;
  let dirty = false;

  const titleInput = el('input', {
    class: 'note-title-input',
    type: 'text',
    value: note.title || '',
    placeholder: t('notes.editor.titlePlaceholder'),
  }) as HTMLInputElement;

  const bodyArea = el('textarea', {
    class: 'note-body-input',
    placeholder: t('notes.editor.bodyPlaceholder'),
  }, note.body || '') as HTMLTextAreaElement;

  const preview = el('div', { class: 'note-preview md-body', hidden: true });
  const status = el('span', { class: 'note-save-status muted' }, '');

  const conflicts = await store.getNoteConflicts(noteId) as Note[];
  const conflictBox = conflicts.length
    ? el('div', { class: 'note-conflicts' }, [
      el('h4', null, t('notes.conflicts.title')),
      ...conflicts.map((c) => el('button', {
        class: 'note-conflict-row',
        type: 'button',
        onclick: () => nav('#note/' + c.id),
      }, c.title || t('notes.untitled'))),
    ])
    : null;

  const cards = await store.getNoteCards(noteId) as Card[];
  const cardsBox = el('div', { class: 'note-cards' }, [
    el('div', { class: 'note-cards-head' }, [
      el('h4', null, t('notes.cards.title')),
      el('button', {
        class: 'btn small',
        type: 'button',
        onclick: () => toast(t('notes.cards.linkHint')),
      }, t('notes.cards.link')),
    ]),
    cards.length
      ? el('ul', { class: 'note-cards-list' }, cards.map((c) =>
        el('li', null, [
          el('button', {
            class: 'note-card-link',
            type: 'button',
            onclick: () => {
              if (c.folder_id) nav('#folder/' + c.folder_id);
            },
          }, stripHtml(c.front || '') || t('notes.cards.untitled')),
          c.note_anchor
            ? el('span', { class: 'muted note-card-anchor' }, '#' + c.note_anchor)
            : null,
        ])
      ))
      : el('p', { class: 'muted' }, t('notes.cards.empty')),
  ]);

  const saveNow = async () => {
    if (!dirty) return;
    dirty = false;
    status.textContent = t('notes.editor.saving');
    const title = titleInput.value.trim() || noteTitleFromBody(bodyArea.value, t('notes.untitled'));
    try {
      await store.updateNote(noteId, { title, body: bodyArea.value });
      status.textContent = t('notes.editor.saved');
      titleInput.value = title;
    } catch (e) {
      dirty = true;
      status.textContent = '';
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const scheduleSave = debounce(() => { void saveNow(); }, SAVE_MS);

  const markDirty = () => {
    dirty = true;
    status.textContent = t('notes.editor.unsaved');
    scheduleSave();
  };

  titleInput.addEventListener('input', markDirty);
  bodyArea.addEventListener('input', markDirty);

  const previewBtn = el('button', {
    class: 'btn',
    type: 'button',
    onclick: () => {
      previewMode = !previewMode;
      bodyArea.hidden = previewMode;
      preview.hidden = !previewMode;
      if (previewMode) preview.innerHTML = renderMarkdown(bodyArea.value);
      previewBtn.textContent = previewMode ? t('notes.editor.edit') : t('notes.editor.preview');
    },
  }, t('notes.editor.preview'));

  const deleteBtn = el('button', {
    class: 'icon-btn',
    title: t('common.delete'),
    onclick: async () => {
      const yes = await confirmDialog(
        t('notes.confirm.deleteTitle'),
        t('notes.confirm.deleteBody'),
        t('common.delete'),
        true,
      );
      if (!yes) return;
      await saveNow();
      await store.deleteNote(noteId);
      toast(t('notes.toast.deleted'));
      nav('#notes');
    },
  }, svgNode(ICONS.trash));

  const head = el('div', { class: 'page-head' }, [
    backBtn('#notes'),
    el('h2', { class: 'page-title grow' }, t('notes.editor.heading')),
    status,
    previewBtn,
    deleteBtn,
  ]);

  const banner = note.conflict_of
    ? el('div', { class: 'note-conflict-banner' }, [
      t('notes.conflicts.banner'),
      ' ',
      el('button', {
        class: 'btn small',
        type: 'button',
        onclick: () => nav('#note/' + note.conflict_of),
      }, t('notes.conflicts.openOriginal')),
    ])
    : null;

  shell('note', el('div', null, [
    offlineBanner(),
    el('div', { class: 'note-editor-page' }, [
      head,
      banner,
      titleInput,
      bodyArea,
      preview,
      conflictBox,
      cardsBox,
    ]),
  ]), null);
}
