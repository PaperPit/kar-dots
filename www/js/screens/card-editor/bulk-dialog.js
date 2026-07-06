import { store } from '../../core/state.js';
import { el, toast, modal, spinner } from '../../ui/ui.js';
import { parseBulkLines, countReadyRows } from '../../lib/card-import.js';
import { getTranslateDir, translateBatch, sleep } from '../../lib/translate.js';
import { createTranslateDirToggle } from '../../ui/translate-dir-toggle.js';
import { route } from '../../core/router.js';

export function bulkCardDialog(folderId) {
  let m;
  let addBtn;
  let previewEl;

  const textarea = el('textarea', {
    class: 'input bulk-textarea',
    rows: 12,
    placeholder: 'слово — перевод\nhello — привет\n# комментарии игнорируются',
  });

  const translateMissingChk = el('input', { type: 'checkbox', class: 'chk' });
  const { btn: dirToggleBtn, getDir: getTranslateDirLocal } = createTranslateDirToggle(getTranslateDir());

  function updatePreview() {
    const { rows, skipped, wordOnly } = parseBulkLines(textarea.value);
    const ready = countReadyRows(rows);
    const needTr = wordOnly.length;
    let msg = `Готово к добавлению: ${ready}`;
    if (translateMissingChk.checked && needTr) msg += ` · перевести: ${needTr}`;
    if (skipped) msg += ` · пропущено: ${skipped}`;
    previewEl.textContent = msg;
    addBtn.disabled = ready === 0 && !(translateMissingChk.checked && needTr);
  }

  textarea.addEventListener('input', updatePreview);
  translateMissingChk.addEventListener('change', updatePreview);

  async function submit() {
    const { rows } = parseBulkLines(textarea.value);
    let toCreate = rows.filter(r => r.front && r.back);

    addBtn.disabled = true;
    addBtn.innerHTML = '';
    addBtn.append(spinner(16));

    try {
      if (translateMissingChk.checked) {
        const words = rows.filter(r => r.front && !r.back).map(r => r.front);
        if (words.length) {
          previewEl.textContent = `Перевожу 0 / ${words.length}…`;
          const translated = await translateBatch(words, getTranslateDirLocal(), (done, total) => {
            previewEl.textContent = `Перевожу ${done} / ${total}…`;
          });
          for (const t of translated) {
            if (t.back) toCreate.push({ front: t.front, back: t.back });
          }
          await sleep(0);
        }
      }

      if (!toCreate.length) {
        toast('Нет карточек для добавления', 'error');
        return;
      }

      let ok = 0;
      for (const row of toCreate) {
        await store.createCard({
          folder_id: folderId,
          front: row.front,
          back: row.back,
          description: '',
        });
        ok++;
      }
      m.close();
      await route();
      toast(`Добавлено карточек: ${ok}`, 'ok');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'Добавить';
      updatePreview();
    }
  }

  previewEl = el('p', { class: 'bulk-preview muted' }, 'Готово к добавлению: 0');
  addBtn = el('button', { class: 'btn primary', onclick: submit, disabled: true }, 'Добавить');

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, 'Добавить списком'),
    el('p', { class: 'modal-text' }, 'По одной паре на строку.'),
    textarea,
    el('div', { class: 'bulk-options' }, [
      el('label', { class: 'bulk-option-row' }, [
        translateMissingChk,
        el('span', null, 'Перевести строки без перевода'),
      ]),
      el('div', { class: 'bulk-option-row' }, [
        el('span', { class: 'bulk-option-lab' }, 'Направление:'),
        dirToggleBtn,
      ]),
    ]),
    previewEl,
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      addBtn,
    ]),
  ]), { wide: true, sticky: true });

  updatePreview();
  setTimeout(() => textarea.focus(), 260);
}
