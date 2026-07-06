import { el, toast, sanitizeRich } from './ui.js';
import { ICONS } from './constants.js';
import { svgNode } from './helpers.js';

const HIGHLIGHT_PRESETS = [
  { id: 'terra', title: 'Терракота' },
  { id: 'green', title: 'Зелёный' },
  { id: 'rose', title: 'Розовый' },
  { id: 'sand', title: 'Песочный' },
  { id: 'sky', title: 'Голубой' },
];

export function richEditor(opts) {
  opts = opts || {};
  const editable = el('div', {
    class: 'input rich-input', contenteditable: 'true',
    'data-placeholder': opts.placeholder || '',
  });
  editable.innerHTML = sanitizeRich(opts.value || '');

  let savedRange = null;
  let hlMenuOpen = false;

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
    try { underlineBtn.classList.toggle('active', document.queryCommandState('underline')); } catch (e) {}
  }

  function closeHlMenu() {
    hlMenu.hidden = true;
    hlMenuOpen = false;
    highlightBtn.classList.remove('active');
  }

  function wrapSelection(tagName, className) {
    editable.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      toast('Сначала выделите текст', 'error');
      return false;
    }
    const range = sel.getRangeAt(0);
    if (!editable.contains(range.commonAncestorContainer)) return false;

    const node = document.createElement(tagName);
    if (className) node.className = className;
    try {
      range.surroundContents(node);
    } catch {
      node.appendChild(range.extractContents());
      range.insertNode(node);
    }
    const next = document.createRange();
    next.selectNodeContents(node);
    sel.removeAllRanges();
    sel.addRange(next);
    saveSelection();
    return true;
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

  const underlineBtn = el('button', {
    type: 'button', class: 'rich-btn', title: 'Подчёркнутый',
    onclick: e => {
      e.preventDefault();
      editable.focus(); restoreSelection();
      document.execCommand('underline');
      saveSelection(); updateToolbarState();
    },
  }, svgNode(ICONS.underline));

  const hlMenu = el('div', { class: 'rich-hl-menu', hidden: true });
  HIGHLIGHT_PRESETS.forEach(preset => {
    hlMenu.append(el('button', {
      type: 'button',
      class: 'rich-hl-swatch rich-hl-' + preset.id,
      title: preset.title,
      onclick: e => {
        e.preventDefault();
        e.stopPropagation();
        if (wrapSelection('mark', 'rich-hl-' + preset.id)) closeHlMenu();
      },
    }));
  });

  const highlightBtn = el('button', {
    type: 'button', class: 'rich-btn rich-btn-highlight', title: 'Выделить цветом',
    onclick: e => {
      e.preventDefault();
      e.stopPropagation();
      hlMenuOpen = !hlMenuOpen;
      hlMenu.hidden = !hlMenuOpen;
      highlightBtn.classList.toggle('active', hlMenuOpen);
    },
  }, svgNode(ICONS.highlight));

  const highlightWrap = el('div', { class: 'rich-highlight-wrap' }, [highlightBtn, hlMenu]);

  const linkBtn = el('button', {
    type: 'button', class: 'rich-btn', title: 'Ссылка',
    onclick: e => {
      e.preventDefault();
      closeHlMenu();
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

  const onDocClick = (e) => {
    if (!hlMenuOpen) return;
    if (highlightWrap.contains(e.target)) return;
    closeHlMenu();
  };
  document.addEventListener('click', onDocClick);

  const toolbar = opts.toolbar === false ? null : el('div', { class: 'rich-toolbar' }, [
    boldBtn, underlineBtn, highlightWrap, linkBtn,
  ]);
  const externalToolbar = !!(toolbar && opts.toolbarExternal);
  const wrap = el('div', { class: 'rich-editor' }, externalToolbar ? [editable] : (toolbar ? [toolbar, editable] : [editable]));
  return {
    node: wrap,
    toolbar: externalToolbar ? toolbar : null,
    getHTML: () => sanitizeRich(editable.innerHTML),
    getPlain: () => editable.textContent.trim(),
    setPlain: text => { editable.textContent = String(text || ''); },
    isEmpty: () => !editable.textContent.trim(),
    focus: () => editable.focus(),
    destroy() { document.removeEventListener('click', onDocClick); },
  };
}
