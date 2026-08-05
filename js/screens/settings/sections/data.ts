import { el, toast } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
import type { AppStore } from '../../../core/state.js';

export function buildDataGroup(store: AppStore, route: () => void | Promise<void>) {
  const importInput = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' }, []) as HTMLInputElement;
  importInput.addEventListener('change', async () => {
    if (!importInput.files?.length) return;
    const f = importInput.files[0];
    if (!f) return;
    try {
      await store.importJSON(await f.text());
      toast(t('settings.data.importDone'), 'ok');
      await route();
    } catch (e) {
      toast(t('settings.data.importFailed', { message: e instanceof Error ? e.message : String(e) }), 'error');
    }
  });

  const ankiInput = el('input', {
    type: 'file',
    accept: '.apkg,application/zip,application/octet-stream',
    class: 'hidden',
  }, []) as HTMLInputElement;
  ankiInput.addEventListener('change', async () => {
    if (!ankiInput.files?.length) return;
    const f = ankiInput.files[0];
    if (!f) return;
    ankiInput.value = '';
    toast(t('settings.data.ankiProgress'), 'ok');
    try {
      const { parseApkg } = await import('../../../lib/anki-apkg.js');
      const parsed = await parseApkg(await f.arrayBuffer());
      if (!parsed.decks.length) {
        toast(t('settings.data.ankiEmpty'), 'error');
        return;
      }
      let imported = 0;
      for (const deck of parsed.decks) {
        const existing = store.folders.find((folder) => folder.name === deck.name);
        const folder = existing || await store.createFolder({ name: deck.name });
        for (const card of deck.cards) {
          await store.createCard({
            folder_id: folder.id,
            front: card.front,
            back: card.back,
            description: '',
          });
          imported++;
        }
      }
      toast(t('settings.data.ankiDone', { cards: imported, decks: parsed.decks.length }), 'ok');
      await route();
    } catch (e) {
      toast(t('settings.data.ankiFailed', { message: e instanceof Error ? e.message : String(e) }), 'error');
    }
  });

  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.data.title')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.data.export')),
        el('span', null, t('settings.data.exportHint')),
      ]),
      el('button', {
        class: 'btn',
        onclick: async () => {
          const json = await store.exportJSONFull();
          const blob = new Blob([json], { type: 'application/json' });
          const a = el('a', { href: URL.createObjectURL(blob), download: 'kartochki-backup.json' });
          document.body.append(a); a.click(); a.remove();
        },
      }, t('common.download')),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.data.import')),
        el('span', null, t('settings.data.importHint')),
      ]),
      el('button', { class: 'btn', onclick: () => importInput.click() }, t('settings.data.importFile')),
      importInput,
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.data.anki')),
        el('span', null, t('settings.data.ankiHint')),
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => ankiInput.click(),
      }, t('settings.data.ankiFile')),
      ankiInput,
    ]),
  ]);
}
