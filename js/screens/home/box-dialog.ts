import { store } from '../../core/state.js';
import { el, toast, modal } from '../../ui/ui.js';
import { FOLDER_COLORS } from '../../ui/constants.js';
import { createIconPicker } from '../../ui/icon-picker.js';
import { route } from '../../core/router.js';
import { foldersInBox } from '../../data/store-box.js';
import { folderSaveErrorMessage } from '../../lib/folder-errors.js';
import { normalizeFolderIcon } from '../../lib/folder-icons.js';
import { t, tp } from '../../lib/i18n.js';
import type { Box, Folder } from '../../data/types.js';

export function boxDialog(box: Box | null) {
  let color = box ? box.color : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
  const name = el('input', {
    class: 'input',
    value: box ? box.name : '',
    placeholder: t('box.dialog.namePlaceholder'),
  }, []) as HTMLInputElement;

  const dots = el('div', { class: 'color-row' }, FOLDER_COLORS.map(c =>
    el('button', {
      type: 'button',
      class: 'color-dot' + (c === color ? ' sel' : ''),
      style: { background: c },
      onclick: (e: Event) => {
        color = c;
        dots.querySelectorAll('.color-dot').forEach(d => d.classList.remove('sel'));
        (e.currentTarget as HTMLElement).classList.add('sel');
      },
    })
  ));

  const iconPicker = createIconPicker(box?.icon ?? undefined);

  const selected = new Set(box ? foldersInBox(store.folders, box.id).map(f => f.id) : []);
  const folderList = el('div', { class: 'box-folder-pick' }, []);

  function paintFolderPick() {
    folderList.innerHTML = '';
    const candidates = store.folders.filter((f: Folder) =>
      !f.box_id || (box && f.box_id === box.id)
    );
    if (!candidates.length) {
      folderList.append(el('p', { class: 'field-hint' }, t('box.dialog.noFolders')));
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
      }, []) as HTMLInputElement;
      folderList.append(el('label', { class: 'box-folder-pick-row', for: id }, [
        chk,
        el('span', { class: 'box-folder-pick-name' }, f.name),
      ]));
    }
  }
  paintFolderPick();

  let m: ReturnType<typeof modal>;
  const titleId = 'box-dialog-title';
  const save = el('button', {
    type: 'button',
    class: 'btn primary',
    onclick: async () => {
      const nm = name.value.trim();
      if (!nm) { toast(t('folder.dialog.nameRequired'), 'error'); return; }
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
        toast(folderSaveErrorMessage(e), 'error');
        save.disabled = false;
      }
    },
  }, box ? t('common.save') : t('common.create')) as HTMLButtonElement;

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title', id: titleId }, box ? t('box.dialog.titleEdit') : t('box.dialog.titleNew')),
    el('div', { class: 'field' }, [el('label', null, t('common.name')), name]),
    el('div', { class: 'field' }, [el('label', null, t('common.color')), dots]),
    el('div', { class: 'field' }, [
      el('label', null, t('common.icon')),
      el('p', { class: 'field-hint' }, t('box.dialog.iconHint')),
      iconPicker.node,
    ]),
    el('div', { class: 'field' }, [
      el('label', null, t('box.dialog.foldersLabel')),
      el('p', { class: 'field-hint' }, t('box.dialog.foldersHint')),
      folderList,
    ]),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, t('common.cancel')),
      save,
    ]),
  ]), { labelledBy: titleId });
  setTimeout(() => name.focus(), 260);
}

export function boxDeleteConfirm(box: Box) {
  const n = foldersInBox(store.folders, box.id).length;
  return {
    title: t('box.confirm.deleteTitle'),
    text: n
      ? t('box.confirm.deleteWithFolders', {
          name: box.name,
          n,
          folders: tp('common.folder', n),
        })
      : t('box.confirm.deleteEmpty', { name: box.name }),
    ok: t('common.delete'),
  };
}
