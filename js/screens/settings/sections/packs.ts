import { el } from '../../../ui/ui.js';
import { vocabPacksDialog } from '../../../ui/vocab-packs-dialog.js';

export function buildPacksGroup() {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Лексические паки'),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Уровни CEFR'),
        el('span', null, 'English A0, A1, A2 — готовые карточки из Oxford 3000 с переводом. Устанавливаются как папка, удаляются целиком.'),
      ]),
      el('button', { type: 'button', class: 'btn accent', onclick: () => vocabPacksDialog() }, 'Каталог паков'),
    ]),
  ]);
}
