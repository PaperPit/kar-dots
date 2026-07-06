import { el, toast } from '../../../ui/ui.js';

export function buildDataGroup(store, route) {
  const importInput = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  importInput.addEventListener('change', async () => {
    const f = importInput.files[0];
    if (!f) return;
    try {
      await store.importJSON(await f.text());
      toast('Импорт завершён', 'ok');
      await route();
    } catch (e) { toast('Импорт не удался: ' + e.message, 'error'); }
  });

  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Данные'),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Экспорт'),
        el('span', null, 'Скачать все папки и карточки одним файлом (резервная копия).'),
      ]),
      el('button', {
        class: 'btn',
        onclick: async () => {
          const json = await store.exportJSONFull();
          const blob = new Blob([json], { type: 'application/json' });
          const a = el('a', { href: URL.createObjectURL(blob), download: 'kartochki-backup.json' });
          document.body.append(a); a.click(); a.remove();
        },
      }, 'Скачать'),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Импорт'),
        el('span', null, 'Загрузить файл экспорта — например, перенести карточки из демо-режима в облако.'),
      ]),
      el('button', { class: 'btn', onclick: () => importInput.click() }, 'Выбрать файл'),
      importInput,
    ]),
  ]);
}
