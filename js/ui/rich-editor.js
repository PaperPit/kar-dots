import { el, toast, sanitizeRich } from './ui.js';
import { ICONS } from './constants.js';
import { svgNode } from './helpers.js';

export function richEditor(opts) {
  opts = opts || {};
  const editable = el('div', {
    class: 'input rich-input', contenteditable: 'true',
    'data-placeholder': opts.placeholder || '',
  });
  editable.innerHTML = sanitizeRich(opts.value || '');

  let savedRange = null;
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editable.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  function updateToolbarState() {
    try { boldBtn.classList.toggle('active', document.queryCommandState('bold')); } catch (e) {}
  }
  editable.addEventListener('keyup', () => { saveSelection(); updateToolbarState(); });
  editable.addEventListener('mouseup', () => { saveSelection(); updateToolbarState(); });
  editable.addEventListener('blur', saveSelection);

  const boldBtn = el('button', {
    type: 'button', class: 'rich-btn', title: 'Жирный',
    onclick: e => {
      e.preventDefault();
      editable.focus(); restoreSelection();
      document.execCommand('bold');
      saveSelection(); updateToolbarState();
    },
  }, svgNode(ICONS.bold));

  const linkBtn = el('button', {
    type: 'button', class: 'rich-btn', title: 'Ссылка',
    onclick: e => {
      e.preventDefault();
      editable.focus(); restoreSelection();
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { toast('Сначала выделите текст для ссылки', 'error'); return; }
      const url = window.prompt('Адрес ссылки (https://...)', 'https://');
      if (!url) return;
      editable.focus(); restoreSelection();
      document.execCommand('createLink', false, url.trim());
      saveSelection();
    },
  }, svgNode(ICONS.link));

  const toolbar = opts.toolbar === false ? null : el('div', { class: 'rich-toolbar' }, [boldBtn, linkBtn]);
  const wrap = el('div', { class: 'rich-editor' }, toolbar ? [toolbar, editable] : [editable]);
  return {
    node: wrap,
    getHTML: () => sanitizeRich(editable.innerHTML),
    getPlain: () => editable.textContent.trim(),
    setPlain: text => { editable.textContent = String(text || ''); },
    isEmpty: () => !editable.textContent.trim(),
    focus: () => editable.focus(),
  };
}
