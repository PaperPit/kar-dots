import { el } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { backBtn, nav } from '../../ui/navigation.js';
import { t } from '../../lib/i18n.js';
import { store } from '../../core/state.js';
import { buildNoteGraph } from '../../lib/note-links.js';
import { layoutNoteGraph } from '../../lib/note-graph-layout.js';
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

  if (graph.nodes.length) {
    const width = Math.max(640, Math.min(1100, graph.nodes.length * 70 + 200));
    const height = Math.max(420, Math.min(720, graph.nodes.length * 48 + 160));
    const laid = layoutNoteGraph(graph.nodes, graph.edges, width, height);
    const byId = new Map(laid.nodes.map((n) => [n.id, n]));

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'notes-graph-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('notes.graph.title'));

    for (const e of laid.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
      line.setAttribute('class', 'notes-graph-edge notes-graph-edge--' + e.kind);
      svg.appendChild(line);
    }

    for (const n of laid.nodes) {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'notes-graph-node notes-graph-node--' + n.kind);
      g.style.cursor = 'pointer';

      if (n.kind === 'folder') {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', String(n.x - 28));
        rect.setAttribute('y', String(n.y - 16));
        rect.setAttribute('width', '56');
        rect.setAttribute('height', '32');
        rect.setAttribute('rx', '3');
        g.appendChild(rect);
      } else {
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', String(n.x));
        circle.setAttribute('cy', String(n.y));
        circle.setAttribute('r', '14');
        g.appendChild(circle);
      }

      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', String(n.x));
      label.setAttribute('y', String(n.y + (n.kind === 'folder' ? 28 : 28)));
      label.setAttribute('text-anchor', 'middle');
      label.textContent = (n.title || t('notes.untitled')).slice(0, 28);
      g.appendChild(label);

      g.addEventListener('click', () => {
        if (n.kind === 'note') nav('#note/' + n.id);
        else if (n.id.startsWith('folder:')) nav('#notes/folder/' + n.id.slice(7));
      });
      svg.appendChild(g);
    }

    stage.append(svg);
  }

  shell('notes', el('div', null, [
    offlineBanner(),
    el('div', { class: 'notes-page notes-graph-page' }, [head, legend, stage, empty]),
  ]), null);
}
