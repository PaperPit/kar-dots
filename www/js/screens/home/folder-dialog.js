import { store } from '../../core/state.js';
import { el, toast, modal } from '../../ui/ui.js';
import { FOLDER_COLORS } from '../../ui/constants.js';
import { featherIcon, modalHead } from '../../ui/helpers.js';
import { createIconPicker } from '../../ui/icon-picker.js';
import { route } from '../../core/router.js';
import { normalizeFolderIcon } from '../../lib/folder-icons.js';

export function folderDialog(folder, opts = {}) {
  let color = folder ? folder.color : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
  const name = el('input', { class: 'input', value: folder ? folder.name : '', placeholder: 'Например, Английский' });

  const dots = el('div', { class: 'color-row' }, FOLDER_COLORS.map(c =>
    el('button', {
      type: 'button',
      class: 'color-dot' + (c === color ? ' sel' : ''), style: { background: c },
      onclick: e => {
        color = c;
        dots.querySelectorAll('.color-dot').forEach(d => d.classList.remove('sel'));
        e.currentTarget.classList.add('sel');
      },
    })
  ));

  const iconPicker = createIconPicker(folder?.icon);

  let m;
  const save = el('button', {
    class: 'btn primary',
    onclick: async () => {
      const nm = name.value.trim();
      if (!nm) { toast('Введите название', 'error'); return; }
      save.disabled = true;
      try {
        const patch = { name: nm, color, icon: normalizeFolderIcon(iconPicker.getIcon()) };
        if (folder) await store.updateFolder(folder.id, patch);
        else await store.createFolder(Object.assign({ box_id: opts.box_id || null }, patch));
        m.close(); await route();
      } catch (e) { toast(e.message || 'Не удалось сохранить папку', 'error'); save.disabled = false; }
    },
  }, folder ? 'Сохранить' : 'Создать');

  m = modal(el('div', null, [
    folder ? modalHead('Папка', featherIcon('modal-head-icon')) : el('h3', { class: 'modal-title' }, 'Новая папка'),
    el('div', { class: 'field' }, [el('label', null, 'Название'), name]),
    el('div', { class: 'field' }, [el('label', null, 'Цвет'), dots]),
    el('div', { class: 'field' }, [
      el('label', null, 'Значок'),
      el('p', { class: 'field-hint' }, 'Если ничего не выбрано — первая буква названия. Повторное нажатие снимает выбор.'),
      iconPicker.node,
    ]),
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      save,
    ]),
  ]));
  setTimeout(() => name.focus(), 260);
}
