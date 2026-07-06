import { el } from './ui.js';
import { folderIconNode } from './icons.js';
import { ALL_PICKER_ICONS, folderHasCustomIcon } from '../lib/folder-icons.js';

/** Сетка иконок (2 ряда по 8); null = первая буква названия. */
export function createIconPicker(initialIcon) {
  let icon = folderHasCustomIcon(initialIcon) ? initialIcon : null;
  const row = el('div', { class: 'folder-icon-row' });

  function paintAll() {
    row.querySelectorAll('.folder-icon-pick').forEach(btn => {
      const id = btn.getAttribute('data-icon');
      const selected = icon === id;
      btn.classList.toggle('sel', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  ALL_PICKER_ICONS.forEach(item => {
    row.append(el('button', {
      type: 'button',
      class: 'folder-icon-pick',
      'data-icon': item.id,
      title: item.label,
      'aria-label': item.label,
      'aria-pressed': 'false',
      onclick: () => {
        icon = icon === item.id ? null : item.id;
        paintAll();
      },
    }, folderIconNode(item.id)));
  });

  paintAll();
  return { node: row, getIcon: () => icon };
}
