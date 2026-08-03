import { store } from '../../core/state.js';
import { setRouteDisposer } from '../../core/route-lifecycle.js';
import { el, toast, confirmDialog, stripHtml } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { debounce, svgNode } from '../../ui/helpers.js';
import { ICONS } from '../../ui/constants.js';
import { renderMarkdown, noteTitleFromBody, escapeHtml, slugify } from '../../lib/markdown.js';
import {
  buildNoteTitleIndex,
  extractHashtags,
  findBacklinks,
  findUnlinkedMentions,
  linkFirstUnlinkedMention,
  rewriteWikiLinks,
  countWikiLinksToTitle,
  buildNoteGraph,
  filterEgoGraph,
  resolveWikiTarget,
  type BacklinkRef,
} from '../../lib/note-links.js';
import { resolveImageUrl } from '../../data/image-url.js';
import { showMarkdownHelp } from './markdown-help.js';
import { createNoteEditor, type NoteCmEditor } from '../../ui/editor.js';
import { mountNotesGraphCanvas, type GraphCanvasHandle } from '../../ui/notes-graph-canvas.js';
import { selectionToCardPayload } from './selection-to-card.js';
import { pickFolderDialog } from './pick-folder.js';
import { confirmWikiRename } from './rename-wiki.js';
import { t, tp } from '../../lib/i18n.js';
import { noteMemory, type NoteMemoryState } from '../../lib/note-memory.js';
import { buildReviewHash } from '../../lib/study-modes.js';
import type { SrsRow } from '../../lib/srs.js';
import type { Note, Card, Folder } from '../../data/types.js';

const SAVE_MS = 500;
const PREVIEW_MS = 200;

type ViewMode = 'edit' | 'preview' | 'split';

export type RenderNoteOpts = {
  heading?: string | null;
};

async function hydratePreviewImages(root: HTMLElement) {
  const imgs = root.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src) continue;
    try {
      const signed = await resolveImageUrl(src);
      if (signed && signed !== src) img.setAttribute('src', signed);
    } catch { /* ignore */ }
  }
}

function toolBtn(icon: string, title: string, onclick: () => void, extraClass = ''): HTMLButtonElement {
  return el('button', {
    class: 'note-tool-btn' + (extraClass ? ' ' + extraClass : ''),
    type: 'button',
    title,
    'aria-label': title,
    onclick,
  }, svgNode(icon)) as HTMLButtonElement;
}

function snippetBlock(s: { before: string; match: string; after: string }) {
  return el('pre', { class: 'note-backlink-snippet' }, [
    el('span', { class: 'muted' }, s.before),
    el('mark', null, s.match),
    el('span', { class: 'muted' }, s.after),
  ]);
}

function backlinkList(items: BacklinkRef[], emptyText: string, action?: (item: BacklinkRef) => HTMLElement | null) {
  if (!items.length) return el('p', { class: 'muted' }, emptyText);
  return el('ul', { class: 'note-backlinks-list' }, items.map((b) =>
    el('li', { class: 'note-backlink-item' }, [
      el('button', {
        class: 'note-card-link',
        type: 'button',
        onclick: () => nav('#note/' + b.id),
      }, b.title || t('notes.untitled')),
      ...b.snippets.slice(0, 3).map(snippetBlock),
      action?.(b) || null,
    ])
  ));
}

export async function renderNote(noteId: string, opts: RenderNoteOpts = {}) {
  const note = await store.getNote(noteId) as Note | null;
  if (!note) {
    toast(t('notes.toast.missing'), 'error');
    nav('#notes');
    return;
  }

  const initialHeading = (opts.heading || '').trim();
  let viewMode: ViewMode = initialHeading ? 'preview' : 'edit';
  let dirty = false;
  let disposed = false;
  let cm: NoteCmEditor | null = null;
  let lineNums = false;
  let savedTitle = note.title || '';
  let localDepth = 1;
  let localGraph: GraphCanvasHandle | null = null;
  let pendingHeading = initialHeading;

  let allNotes = await store.listNotes({ includeConflicts: false }) as Note[];
  const folders = (store.folders || []) as Folder[];

  // Memory-state агрегаты по note_id — однопроходно, для бейджей и локального графа.
  const memoryByNoteId = buildMemoryIndex();
  function buildMemoryIndex(): Map<string, NoteMemoryState> {
    const algo = store.settings.algo;
    const rows = store.getAllSrsRows() as (SrsRow & { note_id?: string | null })[];
    const byNote = new Map<string, SrsRow[]>();
    for (const r of rows) {
      if (!r.note_id) continue;
      let list = byNote.get(r.note_id);
      if (!list) byNote.set(r.note_id, (list = []));
      list.push(r);
    }
    const map = new Map<string, NoteMemoryState>();
    for (const [id, cards] of byNote) {
      map.set(id, noteMemory({ cards, algo }).state);
    }
    return map;
  }

  const titleInput = el('input', {
    class: 'note-title-input',
    type: 'text',
    value: note.title || '',
    placeholder: t('notes.editor.titlePlaceholder'),
    'aria-label': t('notes.editor.titleLabel'),
  }) as HTMLInputElement;

  const editorHost = el('div', { class: 'note-cm-host', 'aria-label': t('notes.editor.bodyLabel') });
  const preview = el('div', { class: 'note-preview md-body' });
  const split = el('div', { class: 'note-split note-split--edit' }, [editorHost, preview]);
  const status = el('span', { class: 'note-save-status muted' }, '');
  const tagsRow = el('div', { class: 'note-tags' });
  const localGraphHost = el('div', { class: 'note-local-graph-stage' });
  const backlinksHost = el('div', { class: 'note-backlinks' });
  const unlinkedHost = el('div', { class: 'note-unlinked' });

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

  const cardsBox = el('div', { class: 'note-cards' });
  const memoryBox = el('div', { class: 'note-memory' });

  function renderMemoryPanel(cards: SrsRow[]) {
    const algo = store.settings.algo;
    const mem = noteMemory({ cards, algo });
    memoryBox.replaceChildren();

    if (mem.state === 'none') {
      memoryBox.append(
        el('div', { class: 'note-memory-empty' }, [
          el('p', { class: 'muted' }, t('notes.memory.noCardsHint')),
        ])
      );
      return;
    }

    const state = mem.state as NoteMemoryState;
    const chips = el('div', { class: 'note-memory-chips' }, [
      el('span', { class: 'note-memory-badge note-memory-badge--' + state }, [
        el('span', { class: 'note-memory-dot', 'aria-hidden': 'true' }),
        t(`notes.memory.state.${state}`),
      ]),
      el('span', { class: 'muted note-memory-summary' },
        mem.due > 0
          ? t('notes.memory.summary', {
            total: String(mem.total),
            due: String(mem.due),
            cards: tp('common.card', mem.total),
          })
          : t('notes.memory.summaryNoDue', {
            total: String(mem.total),
            cards: tp('common.card', mem.total),
          })),
    ]);

    const actions = el('div', { class: 'note-memory-actions' }, [
      mem.due > 0
        ? el('button', {
          class: 'btn accent small',
          type: 'button',
          onclick: () => nav(buildReviewHash(null, { noteId })),
        }, t('notes.memory.reviewDue', { n: String(mem.due) }))
        : null,
      el('button', {
        class: 'btn ghost small',
        type: 'button',
        onclick: () => nav(buildReviewHash(null, { noteId })),
      }, t('notes.memory.reviewAll')),
    ]);

    memoryBox.append(
      el('div', { class: 'note-memory-head' }, [
        el('h4', null, t('notes.memory.title')),
      ]),
      chips,
      actions,
    );
  }

  async function refreshCards() {
    const cards = await store.getNoteCards(noteId) as Card[];
    const rows = store.getAllSrsRows() as (SrsRow & { note_id?: string | null })[];
    renderMemoryPanel(rows.filter((r) => r.note_id === noteId));
    cardsBox.replaceChildren(
      el('div', { class: 'note-cards-head' }, [el('h4', null, t('notes.cards.title'))]),
      el('p', { class: 'muted note-cards-hint' }, t('notes.cards.linkHint')),
      cards.length
        ? el('ul', { class: 'note-cards-list' }, cards.map((c) =>
          el('li', null, [
            el('button', {
              class: 'note-card-link',
              type: 'button',
              onclick: () => { if (c.folder_id) nav('#folder/' + c.folder_id); },
            }, stripHtml(c.front || '') || t('notes.cards.untitled')),
            c.note_anchor
              ? el('span', { class: 'muted note-card-anchor' }, '#' + c.note_anchor)
              : null,
          ])
        ))
        : el('p', { class: 'muted' }, t('notes.cards.empty')),
    );
  }
  await refreshCards();

  function refreshBacklinks() {
    const title = titleInput.value.trim() || savedTitle;
    const bl = findBacklinks(noteId, title, allNotes);
    backlinksHost.replaceChildren(
      el('h4', null, t('notes.backlinks.title')),
      backlinkList(bl, t('notes.backlinks.empty')),
      el('p', { class: 'muted note-cards-hint' }, t('notes.backlinks.hint')),
    );

    const ul = findUnlinkedMentions(title, allNotes, noteId);
    unlinkedHost.replaceChildren(
      el('h4', null, t('notes.unlinked.title')),
      backlinkList(ul, t('notes.unlinked.empty'), (item) =>
        el('button', {
          class: 'btn small',
          type: 'button',
          onclick: async () => {
            const yes = await confirmDialog(
              t('notes.unlinked.linkTitle'),
              t('notes.unlinked.linkBody', { title }),
              t('notes.unlinked.link'),
            );
            if (!yes) return;
            const target = allNotes.find((n) => n.id === item.id);
            if (!target) return;
            const nextBody = linkFirstUnlinkedMention(target.body || '', title);
            if (nextBody === (target.body || '')) {
              toast(t('notes.unlinked.failed'), 'error');
              return;
            }
            await store.updateNote(item.id, { body: nextBody });
            allNotes = await store.listNotes({}) as Note[];
            refreshBacklinks();
            toast(t('notes.unlinked.done'));
          },
        }, t('notes.unlinked.link'))
      ),
      el('p', { class: 'muted note-cards-hint' }, t('notes.unlinked.hint')),
    );
  }
  refreshBacklinks();

  function refreshLocalGraph() {
    localGraph?.destroy();
    localGraph = null;
    localGraphHost.replaceChildren();
    const g = buildNoteGraph(allNotes, folders);
    const ego = filterEgoGraph(g, noteId, localDepth);
    if (!ego.nodes.length) {
      localGraphHost.append(el('p', { class: 'muted' }, t('notes.localGraph.empty')));
      return;
    }
    for (const n of ego.nodes) {
      if (n.kind === 'note') n.memory = memoryByNoteId.get(n.id) || 'none';
    }
    localGraph = mountNotesGraphCanvas({
      parent: localGraphHost,
      nodes: ego.nodes,
      edges: ego.edges,
      compact: true,
      onNodeClick: (id, kind) => {
        if (kind === 'note') nav('#note/' + id);
        else if (id.startsWith('folder:')) nav('#notes/folder/' + id.slice(7));
      },
    });
  }

  const bodyValue = () => (cm?.getValue() ?? note.body) || '';

  async function maybeRewriteWikiLinks(oldTitle: string, newTitle: string) {
    if (!oldTitle || !newTitle || oldTitle === newTitle) return;
    const hits: { id: string; title: string; count: number }[] = [];
    for (const n of allNotes) {
      if (n.id === noteId || n.conflict_of) continue;
      const count = countWikiLinksToTitle(n.body || '', oldTitle);
      if (!count) continue;
      hits.push({ id: n.id, title: n.title || '', count });
    }
    if (!hits.length) return;
    const ok = await confirmWikiRename({ oldTitle, newTitle, hits });
    if (!ok) return;
    for (const h of hits) {
      const cur = allNotes.find((n) => n.id === h.id);
      if (!cur) continue;
      await store.updateNote(h.id, { body: rewriteWikiLinks(cur.body || '', oldTitle, newTitle) });
    }
    allNotes = await store.listNotes({ includeConflicts: false }) as Note[];
    toast(t('notes.rename.done', { n: String(hits.length) }));
  }

  const saveNow = async () => {
    if (disposed || !dirty) return;
    dirty = false;
    status.textContent = t('notes.editor.saving');
    const body = bodyValue();
    const title = titleInput.value.trim() || noteTitleFromBody(body, t('notes.untitled'));
    const folder_id = folderSelect.value || null;
    const prevTitle = savedTitle;
    try {
      await store.updateNote(noteId, {
        title,
        body,
        folder_id,
        tags: extractHashtags(body),
      });
      if (disposed) return;
      status.textContent = t('notes.editor.saved');
      titleInput.value = title;
      if (prevTitle && prevTitle !== title) await maybeRewriteWikiLinks(prevTitle, title);
      if (disposed) return;
      savedTitle = title;
      refreshTags(body);
      allNotes = await store.listNotes({ includeConflicts: false }) as Note[];
      refreshBacklinks();
      refreshLocalGraph();
    } catch (e) {
      if (!disposed) {
        dirty = true;
        status.textContent = '';
        toast(e instanceof Error ? e.message : String(e), 'error');
      }
    }
  };

  const scheduleSave = debounce(() => { void saveNow(); }, SAVE_MS);
  const schedulePreview = debounce(() => { void renderPreview(); }, PREVIEW_MS);

  const markDirty = () => {
    dirty = true;
    status.textContent = t('notes.editor.unsaved');
    refreshTags(bodyValue());
    scheduleSave();
    if (viewMode !== 'edit') schedulePreview();
  };

  titleInput.addEventListener('input', markDirty);
  folderSelect.addEventListener('change', markDirty);

  async function renderPreview() {
    const idx = buildNoteTitleIndex(allNotes);
    const byId = new Map(allNotes.map((n) => [n.id, n]));
    preview.innerHTML = renderMarkdown(bodyValue(), {
      wikiIndex: idx,
      embedResolver: (target, anchor) => {
        const id = resolveWikiTarget(target, idx);
        if (!id) return null;
        const src = byId.get(id);
        if (!src) return null;
        let body = src.body || '';
        if (anchor) {
          const lines = body.replace(/\r\n?/g, '\n').split('\n');
          const slug = slugify(anchor);
          let start = -1;
          let level = 0;
          for (let i = 0; i < lines.length; i++) {
            const h = /^(#{1,6})\s+(.+)$/.exec(lines[i] || '');
            if (!h) continue;
            if (slugify(h[2]!.trim()) === slug) {
              start = i;
              level = h[1]!.length;
              break;
            }
          }
          if (start >= 0) {
            const chunk = [lines[start]!];
            for (let i = start + 1; i < lines.length; i++) {
              const h = /^(#{1,6})\s+/.exec(lines[i] || '');
              if (h && h[1]!.length <= level) break;
              chunk.push(lines[i]!);
            }
            body = chunk.join('\n');
          }
        }
        const inner = renderMarkdown(body, { wikiIndex: idx });
        return `<aside class="md-embed"><a class="md-embed-open" href="#note/${escapeHtml(id)}">${escapeHtml(src.title || target)}</a><div class="md-embed-body">${inner}</div></aside>`;
      },
    });
    await hydratePreviewImages(preview);
    const heading = pendingHeading || location.hash.split('#')[2] || '';
    if (heading) {
      pendingHeading = '';
      const target = preview.querySelector('#' + CSS.escape(heading));
      target?.scrollIntoView({ block: 'start' });
    }
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
    type: 'file', accept: 'image/*', class: 'hidden', 'aria-hidden': 'true',
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

  const cardFromSelBtn = toolBtn(ICONS.cards, t('notes.cardFromSelection.title'), async () => {
    if (!cm) return;
    const sel = cm.getSelection();
    if (sel.empty || !sel.text.trim()) {
      toast(t('notes.cardFromSelection.needSelection'), 'error');
      return;
    }
    let folderId = folderSelect.value || null;
    if (!folderId) {
      if (!folders.length) {
        toast(t('notes.cardFromSelection.noFolders'), 'error');
        return;
      }
      folderId = await pickFolderDialog(folders);
      if (!folderId) return;
    }
    const payload = selectionToCardPayload({
      selection: sel.text,
      noteId,
      body: bodyValue(),
      cursorPos: sel.from,
      folderId,
    });
    try {
      const card = await store.createCard(payload);
      if (card?.id) await store.linkCardToNote(card.id, noteId, payload.note_anchor);
      await refreshCards();
      toast(t('notes.cardFromSelection.done'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  }, 'note-tool-card');

  const lineNumsBtn = toolBtn(ICONS.lineNumbers, t('notes.toolbar.lineNumbers'), () => {
    lineNums = !lineNums;
    cm?.setLineNumbers(lineNums);
    lineNumsBtn.classList.toggle('is-active', lineNums);
  });

  const modeEditBtn = toolBtn(ICONS.pencil, t('notes.editor.edit'), () => applyViewMode('edit'), 'note-mode-btn');
  const modePreviewBtn = toolBtn(ICONS.note, t('notes.editor.preview'), () => applyViewMode('preview'), 'note-mode-btn');
  const modeSplitBtn = toolBtn(ICONS.columns, t('notes.editor.split'), () => applyViewMode('split'), 'note-mode-btn');

  const toolbar = el('div', { class: 'note-toolbar', role: 'toolbar', 'aria-label': t('notes.toolbar.aria') }, [
    toolBtn(ICONS.h1, t('notes.toolbar.h1'), () => cm?.toggleLinePrefix('#')),
    toolBtn(ICONS.h2, t('notes.toolbar.h2'), () => cm?.toggleLinePrefix('##')),
    toolBtn(ICONS.h3, t('notes.toolbar.h3'), () => cm?.toggleLinePrefix('###')),
    toolBtn(ICONS.bold, t('notes.toolbar.bold'), () => cm?.wrapSelection('**')),
    toolBtn(ICONS.italic, t('notes.toolbar.italic'), () => cm?.wrapSelection('*')),
    toolBtn(ICONS.list, t('notes.toolbar.list'), () => cm?.toggleLinePrefix('-')),
    toolBtn(ICONS.checkbox, t('notes.toolbar.checkbox'), () => cm?.toggleLinePrefix('- [ ]')),
    toolBtn(ICONS.quote, t('notes.toolbar.quote'), () => cm?.toggleLinePrefix('>')),
    toolBtn(ICONS.code, t('notes.toolbar.code'), () => cm?.toggleCodeFence()),
    toolBtn(ICONS.link, t('notes.toolbar.mdLink'), () => {
      cm?.wrapSelection('[', '](https://)');
    }),
    toolBtn(ICONS.note, t('notes.toolbar.wiki'), () => {
      cm?.insertAtCursor(`[[${t('notes.md.help.wikiEx')}]]`);
    }),
    toolBtn(ICONS.image, t('notes.toolbar.image'), () => imageInput.click()),
    cardFromSelBtn,
    lineNumsBtn,
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
      localGraph?.destroy();
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
        modeEditBtn, modeSplitBtn, modePreviewBtn,
      ]),
      deleteBtn,
    ]),
  ]);

  const banner = note.conflict_of
    ? el('div', { class: 'note-conflict-banner' }, [
      t('notes.conflicts.banner'), ' ',
      el('button', {
        class: 'btn small', type: 'button',
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

  const depth1Btn = el('button', {
    class: 'btn small is-active', type: 'button',
    onclick: () => {
      localDepth = 1;
      depth1Btn.classList.add('is-active');
      depth2Btn.classList.remove('is-active');
      refreshLocalGraph();
    },
  }, '1') as HTMLButtonElement;
  const depth2Btn = el('button', {
    class: 'btn small', type: 'button',
    onclick: () => {
      localDepth = 2;
      depth2Btn.classList.add('is-active');
      depth1Btn.classList.remove('is-active');
      refreshLocalGraph();
    },
  }, '2') as HTMLButtonElement;

  const depthSwitch = el('div', { class: 'note-local-graph-depth' }, [
    el('span', { class: 'muted' }, t('notes.localGraph.depth')),
    depth1Btn,
    depth2Btn,
  ]);

  const localGraphBox = el('div', { class: 'note-local-graph' }, [
    el('div', { class: 'note-local-graph-head' }, [
      el('h4', null, t('notes.localGraph.title')),
      depthSwitch,
    ]),
    localGraphHost,
  ]);

  shell('note', el('div', null, [
    offlineBanner(),
    el('div', { class: 'note-editor-page' }, [
      head, banner, titleInput, metaRow, toolbar, split,
      memoryBox, localGraphBox, backlinksHost, unlinkedHost, conflictBox, cardsBox,
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
    onCreateWikiNote: async (title) => {
      try {
        const created = await store.createNote({
          title,
          body: `# ${title}\n`,
          folder_id: folderSelect.value || note.folder_id || null,
        }) as Note;
        allNotes = await store.listNotes({ includeConflicts: false }) as Note[];
        toast(t('notes.wiki.created', { title: created.title || title }));
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'error');
      }
    },
  });

  setRouteDisposer(async () => {
    await saveNow();
    disposed = true;
    cm?.destroy();
    localGraph?.destroy();
    cm = null;
    localGraph = null;
  });

  applyViewMode(viewMode);
  refreshLocalGraph();
}
