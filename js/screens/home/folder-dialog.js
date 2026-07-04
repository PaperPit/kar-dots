import { store } from '../../core/state.js';
import { el, toast, modal } from '../../ui/ui.js';
import { FOLDER_COLORS } from '../../ui/constants.js';
import { route } from '../../core/router.js';

export function folderDialog(folder) {
  let color = folder ? folder.color : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
  const name = el('input', { class: 'input', value: folder ? folder.name : '', placeholder: 'Например, Английский' });
  const dots = el('div', { class: 'color-row' }, FOLDER_COLORS.map(c =>
    el('button', {
      class: 'color-dot' + (c === color ? ' sel' : ''), style: { background: c },
      onclick: e => {
        color = c;
        dots.querySelectorAll('.color-dot').forEach(d => d.classList.remove('sel'));
        e.currentTarget.classList.add('sel');
      },
    })
  ));

  let m;
  const save = el('button', {
    class: 'btn primary',
    onclick: async () => {
      const nm = name.value.trim();
      if (!nm) { toast('Введите название', 'error'); return; }
      save.disabled = true;
      try {
        if (folder) await store.updateFolder(folder.id, { name: nm, color });
        else await store.createFolder({ name: nm, color });
        m.close(); await route();
      } catch (e) { toast(e.message, 'error'); save.disabled = false; }
    },
  }, folder ? 'Сохранить' : 'Создать');

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, folder ? 'Папка' : 'Новая папка'),
    el('div', { class: 'field' }, [el('label', null, 'Название'), name]),
    el('div', { class: 'field' }, [el('label', null, 'Цвет'), dots]),
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      save,
    ]),
  ]));
  setTimeout(() => name.focus(), 260);
}
