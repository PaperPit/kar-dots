import { store } from '../../core/state.js';
import { el, toast, confirmDialog, stripHtml } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { debounce } from '../../ui/helpers.js';
import { ICONS } from '../../ui/constants.js';
import { svgNode } from '../../ui/helpers.js';
import { renderMarkdown, noteTitleFromBody } from '../../lib/markdown.js';
import { buildNoteTitleIndex, extractHashtags, findBacklinks } from '../../lib/note-links.js';
import { resolveImageUrl } from '../../data/image-url.js';
import { showMarkdownHelp } from './markdown-help.js';
import { t } from '../../lib/i18n.js';
import type { Note, Card, Folder } from '../../data/types.js';

const SAVE_MS = 500;

function insertAtCursor(area: HTMLTextAreaElement, text: string) {
  const start = area.selectionStart ?? area.value.length;
  const end = area.selectionEnd ?? start;
  const before = area.value.slice(0, start);
  const after = area.value.slice(end);
  area.value = before + text + after;
  const caret = start + text.length;
  area.focus();
  area.setSelectionRange(caret, caret);
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

async function hydratePreviewImages(root: HTMLElement) {
  const imgs = root.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src) continue;
    try {
      const signed = await resolveImageUrl(src);
      if (signed && signed !== src) img.setAttribute('src', signed);
    } catch {
      /* ignore */
    }
  }
}

export async function renderNote(noteId: string) {
  const note = await store.getNote(noteId) as Note | null;
  if (!note) {
    toast(t('notes.toast.missing'), 'error');
    nav('#notes');
    return;
  }

  let previewMode = false;
  let dirty = false;

  const allNotes = await store.listNotes({ includeConflicts: false }) as Note[];
  const folders = (store.folders || []) as Folder[];

  const titleInput = el('input', {
    class: 'note-title-input',
    type: 'text',
    value: note.title || '',
    placeholder: t('notes.editor.titlePlaceholder'),
    'aria-label': t('notes.editor.titleLabel'),
  }) as HTMLInputElement;

  const bodyArea = el('textarea', {
    class: 'note-body-input',
    placeholder: t('notes.editor.bodyPlaceholder'),
    'aria-label': t('notes.editor.bodyLabel'),
  }, note.body || '') as HTMLTextAreaElement;

  const preview = el('div', { class: 'note-preview md-body', hidden: true });
  const status = el('span', { class: 'note-save-status muted' }, '');
  const tagsRow = el('div', { class: 'note-tags' });

  function refreshTags(body: string) {
    const tags = extractHashtags(body);
    tagsRow.replaceChildren();
    if (!tags.length) {
      tagsRow.append(el('span', { class: 'muted note-tags-empty' }, t('notes.tags.empty')));
      return;
    }
    for (const tag of tags) {
      tagsRow.append(el('button', {
        class: 'note-tag-chip',
        type: 'button',
        onclick: () => nav('#notes/tag/' + encodeURIComponent(tag)),
      }, '#' + tag));
    }
  }
  refreshTags(note.body || '');

  const folderSelect = el('select', {
    class: 'note-folder-select',
    'aria-label': t('notes.folder.label'),
  }, [
    el('option', { value: '' }, t('notes.folder.none')),
    ...folders.map((f) => el('option', { value: f.id }, f.name || f.id)),
  ]) as HTMLSelectElement;
  folderSelect.value = note.folder_id || '';

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
    ]),
    el('p', { class: 'muted note-cards-hint' }, t('notes.cards.linkHint')),
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

  const backlinks = findBacklinks(noteId, note.title || '', allNotes);
  const backlinksBox = el('div', { class: 'note-backlinks' }, [
    el('h4', null, t('notes.backlinks.title')),
    backlinks.length
      ? el('ul', { class: 'note-backlinks-list' }, backlinks.map((b) =>
        el('li', null, el('button', {
          class: 'note-card-link',
          type: 'button',
          onclick: () => nav('#note/' + b.id),
        }, b.title || t('notes.untitled')))
      ))
      : el('p', { class: 'muted' }, t('notes.backlinks.empty')),
    el('p', { class: 'muted note-cards-hint' }, t('notes.backlinks.hint')),
  ]);

  const saveNow = async () => {
    if (!dirty) return;
    dirty = false;
    status.textContent = t('notes.editor.saving');
    const title = titleInput.value.trim() || noteTitleFromBody(bodyArea.value, t('notes.untitled'));
    const folder_id = folderSelect.value || null;
    try {
      await store.updateNote(noteId, {
        title,
        body: bodyArea.value,
        folder_id,
        tags: extractHashtags(bodyArea.value),
      });
      status.textContent = t('notes.editor.saved');
      titleInput.value = title;
      refreshTags(bodyArea.value);
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
    refreshTags(bodyArea.value);
    scheduleSave();
  };

  titleInput.addEventListener('input', markDirty);
  bodyArea.addEventListener('input', markDirty);
  folderSelect.addEventListener('change', markDirty);

  const renderPreview = async () => {
    const idx = buildNoteTitleIndex(await store.listNotes({}) as Note[]);
    preview.innerHTML = renderMarkdown(bodyArea.value, { wikiIndex: idx });
    await hydratePreviewImages(preview);
  };

  const previewBtn = el('button', {
    class: 'btn',
    type: 'button',
    onclick: async () => {
      previewMode = !previewMode;
      bodyArea.hidden = previewMode;
      toolbar.hidden = previewMode;
      preview.hidden = !previewMode;
      if (previewMode) await renderPreview();
      previewBtn.textContent = previewMode ? t('notes.editor.edit') : t('notes.editor.preview');
    },
  }, t('notes.editor.preview'));

  const helpBtn = el('button', {
    class: 'icon-btn',
    type: 'button',
    title: t('notes.md.help.title'),
    'aria-label': t('notes.md.help.title'),
    onclick: () => showMarkdownHelp(),
  }, svgNode(ICONS.help));

  const wikiBtn = el('button', {
    class: 'btn small',
    type: 'button',
    title: t('notes.toolbar.wiki'),
    onclick: () => {
      const sel = bodyArea.value.slice(bodyArea.selectionStart, bodyArea.selectionEnd) || t('notes.md.help.wikiEx');
      insertAtCursor(bodyArea, `[[${sel}]]`);
    },
  }, t('notes.toolbar.wiki'));

  const imageInput = el('input', {
    type: 'file',
    accept: 'image/*',
    class: 'hidden',
    'aria-hidden': 'true',
  }) as HTMLInputElement;

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    imageInput.value = '';
    if (!file) return;
    const alt = window.prompt(t('notes.image.altPrompt'), file.name.replace(/\.[^.]+$/, '')) || '';
    try {
      const url = await store.uploadImage(file, { side: 'note' });
      insertAtCursor(bodyArea, `\n![${alt}](${url})\n`);
      toast(t('notes.image.inserted'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  });

  const imageBtn = el('button', {
    class: 'btn small',
    type: 'button',
    title: t('notes.toolbar.image'),
    onclick: () => imageInput.click(),
  }, [svgNode(ICONS.image), ' ', t('notes.toolbar.image')]);

  const toolbar = el('div', { class: 'note-toolbar' }, [
    wikiBtn,
    imageBtn,
    helpBtn,
    imageInput,
  ]);

  const deleteBtn = el('button', {
    class: 'icon-btn',
    title: t('common.delete'),
    'aria-label': t('common.delete'),
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

  const head = el('div', { class: 'page-head page-head--wrap' }, [
    backBtn('#notes'),
    el('h2', { class: 'page-title grow' }, t('notes.editor.heading')),
    el('div', { class: 'page-head-actions' }, [status, previewBtn, deleteBtn]),
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

  const metaRow = el('div', { class: 'note-meta-row' }, [
    el('label', { class: 'note-folder-label' }, [
      el('span', { class: 'muted' }, t('notes.folder.label')),
      folderSelect,
    ]),
    tagsRow,
  ]);

  shell('note', el('div', null, [
    offlineBanner(),
    el('div', { class: 'note-editor-page' }, [
      head,
      banner,
      titleInput,
      metaRow,
      toolbar,
      bodyArea,
      preview,
      backlinksBox,
      conflictBox,
      cardsBox,
    ]),
  ]), null);
}
