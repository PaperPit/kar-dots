import { el } from './ui.js';

const MIME = 'application/x-kar-folder-id';

/** Drag-and-drop папок — только на десктопе с мышью. */
export function folderDragEnabled() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function readFolderId(dataTransfer) {
  return dataTransfer.getData(MIME) || dataTransfer.getData('text/plain');
}

function hasFolderPayload(dataTransfer) {
  return [...(dataTransfer.types || [])].includes(MIME)
    || [...(dataTransfer.types || [])].includes('text/plain');
}

function wireDropHighlight(el, onDrop) {
  let depth = 0;

  el.addEventListener('dragenter', e => {
    if (!hasFolderPayload(e.dataTransfer)) return;
    e.preventDefault();
    depth++;
    el.classList.add('is-drop-target');
  });

  el.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) el.classList.remove('is-drop-target');
  });

  el.addEventListener('dragover', e => {
    if (!hasFolderPayload(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  el.addEventListener('drop', async e => {
    if (!hasFolderPayload(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    el.classList.remove('is-drop-target');
    const folderId = readFolderId(e.dataTransfer);
    if (!folderId) return;
    await onDrop(folderId);
  });
}

export function attachFolderDraggable(card, folderId) {
  if (!folderDragEnabled()) return;
  card.draggable = true;
  card.classList.add('folder-draggable');
  let suppressClick = false;

  card.addEventListener('dragstart', e => {
    suppressClick = false;
    e.dataTransfer.setData(MIME, folderId);
    e.dataTransfer.setData('text/plain', folderId);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('is-dragging');
    document.documentElement.classList.add('folder-drag-active');
  });

  card.addEventListener('drag', () => { suppressClick = true; });

  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    document.documentElement.classList.remove('folder-drag-active');
    if (suppressClick) {
      setTimeout(() => { suppressClick = false; }, 0);
    }
  });

  card.addEventListener('click', e => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

export function attachBoxDropTarget(card, boxId, onDrop) {
  if (!folderDragEnabled()) return;
  card.classList.add('box-drop-target');
  wireDropHighlight(card, folderId => onDrop(folderId, boxId));
}

export function createUnboxDropZone(onUnbox) {
  const zone = el('div', { class: 'folder-unbox-zone' }, [
    el('span', { class: 'folder-unbox-zone-icon', 'aria-hidden': 'true' }, '↗'),
    el('span', null, 'Отпустите здесь — чтобы достать папку из коробки'),
  ]);
  if (!folderDragEnabled()) {
    zone.hidden = true;
    return zone;
  }
  wireDropHighlight(zone, onUnbox);
  return zone;
}
