import { el } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { debounce, svgNode } from '../../ui/helpers.js';
import { notePreview } from '../../lib/markdown.js';
import { ICONS } from '../../ui/constants.js';
import { t } from '../../lib/i18n.js';
import { store } from '../../core/state.js';
import type { Note, Folder } from '../../data/types.js';

const SEARCH_MS = 200;

export type NotesRouteOpts = {
  tag?: string | null;
  folderId?: string | null;
};

export async function renderNotes(opts: NotesRouteOpts = {}) {
  let activeTag = opts.tag ? decodeURIComponent(opts.tag).toLowerCase() : '';
  let activeFolder = opts.folderId || '';

  const folders = (store.folders || []) as Folder[];
  const folderName = new Map(folders.map((f) => [f.id, f.name || f.id]));

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

  const filters = el('div', { class: 'notes-filters' }, [
    folderFilter,
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
    const notes = await store.listNotes({
      query: query.trim() || undefined,
      folderId: activeFolder || undefined,
      tag: activeTag || undefined,
    }) as Note[];
    list.replaceChildren();
    empty.hidden = notes.length > 0;
    for (const n of notes) list.append(noteRow(n));
  }

  function noteRow(n: Note) {
    const title = n.title || t('notes.untitled');
    const tags = n.tags || [];
    const folderLabel = n.folder_id ? folderName.get(n.folder_id) : '';
    return el('button', {
      class: 'notes-row',
      type: 'button',
      onclick: () => nav('#note/' + n.id),
    }, [
      el('div', { class: 'notes-row-title' }, title),
      el('div', { class: 'notes-row-preview muted' }, notePreview(n.body) || t('notes.empty.body')),
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
