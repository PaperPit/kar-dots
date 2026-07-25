import { el, toast } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
import type { LocalStore } from '../../../data/store-local.js';

export function buildDataGroup(store: LocalStore, route: () => void | Promise<void>) {
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
  ]);
}
