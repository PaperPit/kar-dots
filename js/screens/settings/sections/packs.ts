import { el } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
import { vocabPacksDialog } from '../../../ui/vocab-packs-dialog.js';

export function buildPacksGroup(): HTMLElement {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.packs.title')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.packs.cefr')),
        el('span', null, t('settings.packs.cefrHint')),
      ]),
      el('button', { type: 'button', class: 'btn accent', onclick: () => vocabPacksDialog() }, t('settings.packs.catalog')),
    ]),
  ]);
}
