import { el } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { debounce, svgNode } from '../../ui/helpers.js';
import { notePreview, escapeHtml } from '../../lib/markdown.js';
import { ICONS } from '../../ui/constants.js';
import { t, tp } from '../../lib/i18n.js';
import { store } from '../../core/state.js';
import { noteMemory, noteMemoryLabelKey, type NoteMemoryState, type NoteMemory } from '../../lib/note-memory.js';
import type { SrsRow } from '../../lib/srs.js';
import type { Note, Folder } from '../../data/types.js';

const SEARCH_MS = 200;

export type NotesRouteOpts = {
  tag?: string | null;
  folderId?: string | null;
};

function highlightPrefix(text: string, query: string): string | HTMLElement {
  const raw = String(text || '');
  const q = String(query || '').trim();
  if (!q || q.length < 2) return raw;
  const lower = raw.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return raw;
  const before = escapeHtml(raw.slice(0, idx));
  const match = escapeHtml(raw.slice(idx, idx + q.length));
  const after = escapeHtml(raw.slice(idx + q.length));
  const span = el('span');
  span.innerHTML = `${before}<mark>${match}</mark>${after}`;
  return span;
}

export async function renderNotes(opts: NotesRouteOpts = {}) {
  let activeTag = opts.tag ? decodeURIComponent(opts.tag).toLowerCase() : '';
  let activeFolder = opts.folderId || '';

  const folders = (store.folders || []) as Folder[];
  const folderName = new Map(folders.map((f) => [f.id, f.name || f.id]));

  // Агрегация SRS по note_id — дешёвая, по in-memory slim meta.
  const algo = store.settings.algo;
  const rows = store.getAllSrsRows() as (SrsRow & { note_id?: string | null })[];
  const byNote = new Map<string, SrsRow[]>();
  for (const r of rows) {
    if (!r.note_id) continue;
    let list = byNote.get(r.note_id);
    if (!list) byNote.set(r.note_id, (list = []));
    list.push(r);
  }
  const memoryByNote = new Map<string, NoteMemory>();
  for (const [noteId, cards] of byNote) {
    memoryByNote.set(noteId, noteMemory({ cards, algo }));
  }

  const head = el('div', { class: 'page-head page-head--wrap' }, [
    backBtn('#home'),
    el('h2', { class: 'page-title grow' }, t('notes.title')),
    el('div', { class: 'page-head-actions' }, [
      el('button', {
        class: 'btn',
        type: 'button',
        title: t('notes.graph.open'),
        'aria-label': t('notes.graph.open'),
        onclick: () => nav('#notes/graph'),
      }, [svgNode(ICONS.graph), ' ', t('notes.graph.short')]),
      el('button', {
        class: 'btn accent',
        onclick: async () => {
          const note = await store.createNote({
            title: '',
            body: '',
            folder_id: activeFolder || null,
          }) as Note;
          nav('#note/' + note.id);
        },
      }, t('notes.btn.new')),
    ]),
  ]);

  const search = el('input', {
    class: 'notes-search',
    type: 'search',
    placeholder: t('notes.search.placeholder'),
    'aria-label': t('notes.search.aria'),
    autocomplete: 'off',
  }) as HTMLInputElement;

  const folderFilter = el('select', {
    class: 'notes-filter-select',
    'aria-label': t('notes.folder.filter'),
  }, [
    el('option', { value: '' }, t('notes.folder.all')),
    ...folders.map((f) => el('option', { value: f.id }, f.name || f.id)),
  ]) as HTMLSelectElement;
  folderFilter.value = activeFolder;

  let activeMemory: NoteMemoryState | '' = '';

  const memoryFilter = el('select', {
    class: 'notes-filter-select',
    'aria-label': t('notes.memory.filter'),
  }, [
    el('option', { value: '' }, t('notes.memory.all')),
    ...(['fading', 'learning', 'rooted', 'new', 'none'] as NoteMemoryState[]).map((s) =>
      el('option', { value: s }, t(noteMemoryLabelKey(s)))
    ),
  ]) as HTMLSelectElement;

  const filters = el('div', { class: 'notes-filters' }, [
    folderFilter,
    memoryFilter,
    el('div', { class: 'notes-active-filters' }),
  ]);
  const activeFilters = filters.querySelector('.notes-active-filters') as HTMLElement;

  const list = el('div', { class: 'notes-list' });
  const empty = el('div', { class: 'notes-empty', hidden: true }, [
    el('h3', null, t('notes.empty.title')),
    el('p', { class: 'muted' }, t('notes.empty.text')),
  ]);

  function syncFilterChips() {
    activeFilters.replaceChildren();
    if (activeTag) {
      activeFilters.append(
        el('button', {
          class: 'note-tag-chip',
          type: 'button',
          title: t('notes.tags.clear'),
          onclick: () => {
            activeTag = '';
            nav('#notes');
            void refresh(search.value);
            syncFilterChips();
          },
        }, '#' + activeTag + ' ×')
      );
    }
  }

  async function refresh(query = '') {
    const q = query.trim();
    let notes = await store.listNotes({
      query: q || undefined,
      folderId: activeFolder || undefined,
      tag: activeTag || undefined,
    }) as Note[];
    if (activeMemory) {
      notes = notes.filter((n) => (memoryByNote.get(n.id)?.state || 'none') === activeMemory);
    }
    list.replaceChildren();
    empty.hidden = notes.length > 0;
    for (const n of notes) list.append(noteRow(n, q));
  }

  function memoryBadge(mem: NoteMemory | undefined) {
    if (!mem || mem.state === 'none') return null;
    const state = mem.state as NoteMemoryState;
    return el('span', {
      class: 'note-memory-badge note-memory-badge--' + state,
      title: t(`notes.memory.state.${state}`) + (mem.due > 0 ? ` · ${mem.due} ${tp('common.card', mem.due)}` : ''),
    }, [
      el('span', { class: 'note-memory-dot', 'aria-hidden': 'true' }),
      mem.due > 0 ? String(mem.due) : t(`notes.memory.state.${state}`),
    ]);
  }

  function noteRow(n: Note, query = '') {
    const title = n.title || t('notes.untitled');
    const tags = n.tags || [];
    const folderLabel = n.folder_id ? folderName.get(n.folder_id) : '';
    const previewText = notePreview(n.body) || t('notes.empty.body');
    const mem = memoryByNote.get(n.id);
    const memEl = memoryBadge(mem);
    return el('button', {
      class: 'notes-row',
      type: 'button',
      onclick: () => nav('#note/' + n.id),
    }, [
      el('div', { class: 'notes-row-head' }, [
        el('div', { class: 'notes-row-title' }, highlightPrefix(title, query)),
        memEl,
      ]),
      el('div', { class: 'notes-row-preview muted' }, highlightPrefix(previewText, query)),
      el('div', { class: 'notes-row-meta muted' }, [
        formatUpdated(n.updated_at),
        folderLabel ? el('span', { class: 'notes-row-folder' }, ' · ' + folderLabel) : null,
        tags.length
          ? el('span', { class: 'notes-row-tags' }, ' · ' + tags.map((x) => '#' + x).join(' '))
          : null,
      ]),
    ]);
  }

  search.addEventListener('input', debounce(() => {
    refresh(search.value).catch(console.error);
  }, SEARCH_MS));

  folderFilter.addEventListener('change', () => {
    activeFolder = folderFilter.value;
    if (activeFolder) nav('#notes/folder/' + activeFolder);
    else if (activeTag) nav('#notes/tag/' + encodeURIComponent(activeTag));
    else nav('#notes');
    void refresh(search.value);
  });

  memoryFilter.addEventListener('change', () => {
    activeMemory = memoryFilter.value as NoteMemoryState | '';
    void refresh(search.value);
  });

  syncFilterChips();
  await refresh();

  shell('notes', el('div', null, [
    offlineBanner(),
    el('div', { class: 'notes-page' }, [head, search, filters, list, empty]),
  ]), null);
}

function formatUpdated(ts?: number) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}
