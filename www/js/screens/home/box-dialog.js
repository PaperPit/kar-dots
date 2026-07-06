import { store } from '../../core/state.js';
import { el, toast, modal, plural } from '../../ui/ui.js';
import { FOLDER_COLORS } from '../../ui/constants.js';
import { createIconPicker } from '../../ui/icon-picker.js';
import { route } from '../../core/router.js';
import { foldersInBox } from '../../data/store-box.js';
import { normalizeFolderIcon } from '../../lib/folder-icons.js';

export function boxDialog(box) {
  let color = box ? box.color : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
  const name = el('input', {
    class: 'input',
    value: box ? box.name : '',
    placeholder: 'Например, Английский',
  });

  const dots = el('div', { class: 'color-row' }, FOLDER_COLORS.map(c =>
    el('button', {
      type: 'button',
      class: 'color-dot' + (c === color ? ' sel' : ''),
      style: { background: c },
      onclick: e => {
        color = c;
        dots.querySelectorAll('.color-dot').forEach(d => d.classList.remove('sel'));
        e.currentTarget.classList.add('sel');
      },
    })
  ));

  const iconPicker = createIconPicker(box?.icon);

  const selected = new Set(box ? foldersInBox(store.folders, box.id).map(f => f.id) : []);
  const folderList = el('div', { class: 'box-folder-pick' });

  function paintFolderPick() {
    folderList.innerHTML = '';
    const candidates = store.folders.filter(f =>
      !f.box_id || (box && f.box_id === box.id)
    );
    if (!candidates.length) {
      folderList.append(el('p', { class: 'field-hint' }, 'Нет доступных папок — создайте папку на главном экране.'));
      return;
    }
    for (const f of candidates) {
      const id = 'box-pick-' + f.id;
      const chk = el('input', {
        type: 'checkbox',
        id,
        checked: selected.has(f.id),
        onchange: () => {
          if (chk.checked) selected.add(f.id);
          else selected.delete(f.id);
        },
      });
      folderList.append(el('label', { class: 'box-folder-pick-row', for: id }, [
        chk,
        el('span', { class: 'box-folder-pick-name' }, f.name),
      ]));
    }
  }
  paintFolderPick();

  let m;
  const titleId = 'box-dialog-title';
  const save = el('button', {
    type: 'button',
    class: 'btn primary',
    onclick: async () => {
      const nm = name.value.trim();
      if (!nm) { toast('Введите название', 'error'); return; }
      save.disabled = true;
      try {
        const patch = { name: nm, color, icon: normalizeFolderIcon(iconPicker.getIcon()) };
        if (box) {
          await store.updateBox(box.id, patch);
          await store.setBoxFolders(box.id, [...selected]);
        } else {
          const created = await store.createBox(patch);
          if (selected.size) await store.setBoxFolders(created.id, [...selected]);
        }
        m.close();
        await route();
      } catch (e) {
        toast(e.message || 'Не удалось сохранить коробку', 'error');
        save.disabled = false;
      }
    },
  }, box ? 'Сохранить' : 'Создать');

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title', id: titleId }, box ? 'Коробка' : 'Новая коробка'),
    el('div', { class: 'field' }, [el('label', null, 'Название'), name]),
    el('div', { class: 'field' }, [el('label', null, 'Цвет'), dots]),
    el('div', { class: 'field' }, [
      el('label', null, 'Значок'),
      el('p', { class: 'field-hint' }, 'Если ничего не выбрано — первая буква названия. Повторное нажатие снимает выбор.'),
      iconPicker.node,
    ]),
    el('div', { class: 'field' }, [
      el('label', null, 'Папки в коробке'),
      el('p', { class: 'field-hint' }, 'Коробка объединяет папки по теме. Карточки остаются в папках.'),
      folderList,
    ]),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      save,
    ]),
  ]), { labelledBy: titleId });
  setTimeout(() => name.focus(), 260);
}

export function boxDeleteConfirm(box) {
  const n = foldersInBox(store.folders, box.id).length;
  return {
    title: 'Удалить коробку?',
    text: n
      ? `«${box.name}» будет удалена. ${n} ${plural(n, 'папка', 'папки', 'папок')} останутся на главном экране.`
      : `«${box.name}» будет удалена.`,
    ok: 'Удалить',
  };
}
