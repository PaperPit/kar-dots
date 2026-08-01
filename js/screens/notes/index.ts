import { el } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { debounce } from '../../ui/helpers.js';
import { notePreview } from '../../lib/markdown.js';
import { t } from '../../lib/i18n.js';
import { store } from '../../core/state.js';
import type { Note } from '../../data/types.js';

const SEARCH_MS = 200;

export async function renderNotes() {
  const head = el('div', { class: 'page-head' }, [
    backBtn('#home'),
    el('h2', { class: 'page-title grow' }, t('notes.title')),
    el('button', {
      class: 'btn accent',
      onclick: async () => {
        const note = await store.createNote({ title: '', body: '' }) as Note;
        nav('#note/' + note.id);
      },
    }, t('notes.btn.new')),
  ]);

  const search = el('input', {
    class: 'notes-search',
    type: 'search',
    placeholder: t('notes.search.placeholder'),
    autocomplete: 'off',
  }) as HTMLInputElement;

  const list = el('div', { class: 'notes-list' });
  const empty = el('div', { class: 'notes-empty', hidden: true }, [
    el('h3', null, t('notes.empty.title')),
    el('p', { class: 'muted' }, t('notes.empty.text')),
  ]);

  async function refresh(query = '') {
    const notes = await store.listNotes({ query: query.trim() || undefined }) as Note[];
    list.replaceChildren();
    empty.hidden = notes.length > 0;
    for (const n of notes) {
      list.append(noteRow(n));
    }
  }

  function noteRow(n: Note) {
    const title = n.title || t('notes.untitled');
    return el('button', {
      class: 'notes-row',
      type: 'button',
      onclick: () => nav('#note/' + n.id),
    }, [
      el('div', { class: 'notes-row-title' }, title),
      el('div', { class: 'notes-row-preview muted' }, notePreview(n.body) || t('notes.empty.body')),
      el('div', { class: 'notes-row-meta muted' }, formatUpdated(n.updated_at)),
    ]);
  }

  search.addEventListener('input', debounce(() => {
    refresh(search.value).catch(console.error);
  }, SEARCH_MS));

  await refresh();

  shell('notes', el('div', null, [
    offlineBanner(),
    el('div', { class: 'notes-page' }, [head, search, list, empty]),
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