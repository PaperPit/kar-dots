import { store } from '../../core/state.js';
import { el, toast, confirmDialog, stripHtml } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { debounce, svgNode } from '../../ui/helpers.js';
import { ICONS } from '../../ui/constants.js';
import { renderMarkdown, noteTitleFromBody } from '../../lib/markdown.js';
import { buildNoteTitleIndex, extractHashtags, findBacklinks } from '../../lib/note-links.js';
import { resolveImageUrl } from '../../data/image-url.js';
import { showMarkdownHelp } from './markdown-help.js';
import { createNoteEditor, type NoteCmEditor } from '../../ui/editor.js';
import { t } from '../../lib/i18n.js';
import type { Note, Card, Folder } from '../../data/types.js';

const SAVE_MS = 500;

type ViewMode = 'edit' | 'preview' | 'split';

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

function toolBtn(
  icon: string,
  title: string,
  onclick: () => void,
  extraClass = ''
): HTMLButtonElement {
  return el('button', {
    class: 'note-tool-btn' + (extraClass ? ' ' + extraClass : ''),
    type: 'button',
    title,
    'aria-label': title,
    onclick,
  }, svgNode(icon)) as HTMLButtonElement;
}

export async function renderNote(noteId: string) {
  const note = await store.getNote(noteId) as Note | null;
  if (!note) {
    toast(t('notes.toast.missing'), 'error');
    nav('#notes');
    return;
  }

  let viewMode: ViewMode = 'edit';
  let dirty = false;
  let cm: NoteCmEditor | null = null;

  const allNotes = await store.listNotes({ includeConflicts: false }) as Note[];
  const folders = (store.folders || []) as Folder[];

  const titleInput = el('input', {
    class: 'note-title-input',
    type: 'text',
    value: note.title || '',
    placeholder: t('notes.editor.titlePlaceholder'),
    'aria-label': t('notes.editor.titleLabel'),
  }) as HTMLInputElement;

  const editorHost = el('div', {
    class: 'note-cm-host',
    'aria-label': t('notes.editor.bodyLabel'),
  });
  const preview = el('div', { class: 'note-preview md-body' });
  const split = el('div', { class: 'note-split note-split--edit' }, [editorHost, preview]);
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

  const bodyValue = () => (cm?.getValue() ?? note.body) || '';

  const saveNow = async () => {
    if (!dirty) return;
    dirty = false;
    status.textContent = t('notes.editor.saving');
    const body = bodyValue();
    const title = titleInput.value.trim() || noteTitleFromBody(body, t('notes.untitled'));
    const folder_id = folderSelect.value || null;
    try {
      await store.updateNote(noteId, {
        title,
        body,
        folder_id,
        tags: extractHashtags(body),
      });
      status.textContent = t('notes.editor.saved');
      titleInput.value = title;
      refreshTags(body);
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
    refreshTags(bodyValue());
    scheduleSave();
    if (viewMode !== 'edit') void renderPreview();
  };

  titleInput.addEventListener('input', markDirty);
  folderSelect.addEventListener('change', markDirty);

  async function renderPreview() {
    const notes = await store.listNotes({}) as Note[];
    const idx = buildNoteTitleIndex(notes);
    preview.innerHTML = renderMarkdown(bodyValue(), { wikiIndex: idx });
    await hydratePreviewImages(preview);
  }

  function applyViewMode(mode: ViewMode) {
    viewMode = mode;
    split.classList.remove('note-split--edit', 'note-split--preview', 'note-split--split');
    split.classList.add('note-split--' + mode);
    toolbar.hidden = mode === 'preview';
    modeEditBtn.classList.toggle('is-active', mode === 'edit');
    modePreviewBtn.classList.toggle('is-active', mode === 'preview');
    modeSplitBtn.classList.toggle('is-active', mode === 'split');
    if (mode !== 'edit') void renderPreview();
    if (mode !== 'preview') queueMicrotask(() => cm?.focus());
  }

  const imageInput = el('input', {
    type: 'file',
    accept: 'image/*',
    class: 'hidden',
    'aria-hidden': 'true',
  }) as HTMLInputElement;

  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    imageInput.value = '';
    if (!file || !cm) return;
    const alt = window.prompt(t('notes.image.altPrompt'), file.name.replace(/\.[^.]+$/, '')) || '';
    try {
      const url = await store.uploadImage(file, { side: 'note' });
      cm.insertAtCursor(`\n![${alt}](${url})\n`);
      toast(t('notes.image.inserted'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  });

  const modeEditBtn = toolBtn(ICONS.pencil, t('notes.editor.edit'), () => applyViewMode('edit'), 'note-mode-btn');
  const modePreviewBtn = toolBtn(ICONS.note, t('notes.editor.preview'), () => applyViewMode('preview'), 'note-mode-btn');
  const modeSplitBtn = toolBtn(ICONS.columns, t('notes.editor.split'), () => applyViewMode('split'), 'note-mode-btn');

  const toolbar = el('div', { class: 'note-toolbar', role: 'toolbar', 'aria-label': t('notes.toolbar.aria') }, [
    toolBtn(ICONS.h1, t('notes.toolbar.h1'), () => cm?.toggleLinePrefix('#')),
    toolBtn(ICONS.h2, t('notes.toolbar.h2'), () => cm?.toggleLinePrefix('##')),
    toolBtn(ICONS.bold, t('notes.toolbar.bold'), () => cm?.wrapSelection('**')),
    toolBtn(ICONS.italic, t('notes.toolbar.italic'), () => cm?.wrapSelection('*')),
    toolBtn(ICONS.list, t('notes.toolbar.list'), () => cm?.toggleLinePrefix('-')),
    toolBtn(ICONS.checkbox, t('notes.toolbar.checkbox'), () => cm?.toggleLinePrefix('- [ ]')),
    toolBtn(ICONS.quote, t('notes.toolbar.quote'), () => cm?.toggleLinePrefix('>')),
    toolBtn(ICONS.code, t('notes.toolbar.code'), () => cm?.toggleCodeFence()),
    toolBtn(ICONS.link, t('notes.toolbar.wiki'), () => {
      cm?.insertAtCursor(`[[${t('notes.md.help.wikiEx')}]]`);
    }),
    toolBtn(ICONS.image, t('notes.toolbar.image'), () => imageInput.click()),
    toolBtn(ICONS.help, t('notes.md.help.title'), () => showMarkdownHelp()),
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
      cm?.destroy();
      await store.deleteNote(noteId);
      toast(t('notes.toast.deleted'));
      nav('#notes');
    },
  }, svgNode(ICONS.trash));

  const head = el('div', { class: 'page-head page-head--wrap' }, [
    backBtn('#notes'),
    el('h2', { class: 'page-title grow' }, t('notes.editor.heading')),
    el('div', { class: 'page-head-actions' }, [
      status,
      el('div', { class: 'note-mode-switch', role: 'group', 'aria-label': t('notes.editor.viewMode') }, [
        modeEditBtn,
        modeSplitBtn,
        modePreviewBtn,
      ]),
      deleteBtn,
    ]),
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
      split,
      backlinksBox,
      conflictBox,
      cardsBox,
    ]),
  ]), null);

  cm = createNoteEditor({
    parent: editorHost,
    doc: note.body || '',
    placeholder: t('notes.editor.bodyPlaceholder'),
    ariaLabel: t('notes.editor.bodyLabel'),
    onChange: () => markDirty(),
    getWikiSuggestions: () =>
      allNotes
        .filter((n) => n.id !== noteId)
        .map((n) => ({ title: n.title || t('notes.untitled'), id: n.id })),
    getTagSuggestions: () => {
      const set = new Set<string>();
      for (const n of allNotes) {
        for (const tag of n.tags || extractHashtags(n.body || '')) set.add(tag);
      }
      return [...set];
    },
  });

  applyViewMode('edit');
}
