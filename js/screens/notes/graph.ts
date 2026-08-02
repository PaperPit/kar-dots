import { el } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { t } from '../../lib/i18n.js';
import { store } from '../../core/state.js';
import { setRouteDisposer } from '../../core/route-lifecycle.js';
import { buildNoteGraph } from '../../lib/note-links.js';
import { mountNotesGraphCanvas, type GraphCanvasHandle } from '../../ui/notes-graph-canvas.js';
import type { Note, Folder } from '../../data/types.js';

/** Экран графа: заметки, папки и wiki-связи. */
export async function renderNotesGraph() {
  const notes = await store.listNotes({}) as Note[];
  const folders = (store.folders || []) as Folder[];
  const graph = buildNoteGraph(notes, folders);

  const head = el('div', { class: 'page-head page-head--wrap' }, [
    backBtn('#notes'),
    el('h2', { class: 'page-title grow' }, t('notes.graph.title')),
  ]);

  const legend = el('div', { class: 'notes-graph-legend muted' }, [
    el('span', { class: 'notes-graph-leg notes-graph-leg--note' }, t('notes.graph.legendNote')),
    el('span', { class: 'notes-graph-leg notes-graph-leg--folder' }, t('notes.graph.legendFolder')),
    el('span', { class: 'notes-graph-leg notes-graph-leg--wiki' }, t('notes.graph.legendWiki')),
  ]);

  const stage = el('div', { class: 'notes-graph-stage' });
  const empty = el('div', { class: 'notes-empty', hidden: graph.nodes.length > 0 }, [
    el('h3', null, t('notes.graph.emptyTitle')),
    el('p', { class: 'muted' }, t('notes.graph.emptyText')),
  ]);

  let canvas: GraphCanvasHandle | null = null;
  if (graph.nodes.length) {
    canvas = mountNotesGraphCanvas({
      parent: stage,
      nodes: graph.nodes,
      edges: graph.edges,
      onNodeClick: (id, kind) => {
        if (kind === 'note') nav('#note/' + id);
        else if (id.startsWith('folder:')) nav('#notes/folder/' + id.slice(7));
      },
    });
  }

  setRouteDisposer(() => {
    canvas?.destroy();
    canvas = null;
  });

  shell('notes', el('div', null, [
    offlineBanner(),
    el('div', { class: 'notes-page notes-graph-page' }, [head, legend, stage, empty]),
  ]), null);
}
