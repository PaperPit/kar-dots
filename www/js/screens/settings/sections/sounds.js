import { el } from '../../../ui/ui.js';
import {
  SUCCESS_MELODIES, FAIL_MELODIES, CUP_MELODIES, UI_CLICK_MELODIES,
  playSuccessSound, playFailSound, playCupMelody, playUiClickSound,
  normalizeSuccessSoundId, normalizeFailSoundId, normalizeAnswerSoundMode,
  normalizeCupMelodyId, normalizeUiClickSoundId,
} from '../../../lib/sounds.js';
import { melodyPickerField } from '../../../ui/melody-picker.js';
import { segControl } from '../shared.js';

export function buildSoundGroup(s, save) {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Звуки'),
    el('div', { class: 'setting-row setting-row-stack sound-settings-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Клики интерфейса'),
        el('span', null, 'Звук при нажатии кнопок, вкладок и пунктов меню. «Без звука» — тихий интерфейс.'),
      ]),
      el('div', { class: 'sound-pickers' }, [
        melodyPickerField({
          label: 'Клики',
          value: normalizeUiClickSoundId(s.uiClickSound),
          melodies: UI_CLICK_MELODIES,
          play: id => { if (id !== 'none') playUiClickSound(id, { preview: true }); },
          onChange: id => { s.uiClickSound = id; save(); },
        }),
      ]),
    ]),
    el('div', { class: 'setting-row setting-row-stack sound-settings-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Мелодии ответов'),
        el('span', null, 'Короткие отбивки в режимах «Ввод», «Голос» и «Пары»; отдельно — мелодия при появлении кубка. Нажмите ▶ в меню, чтобы прослушать.'),
      ]),
      el('div', { class: 'sound-pickers' }, [
        melodyPickerField({
          label: 'Верно',
          value: normalizeSuccessSoundId(s.successSound),
          melodies: SUCCESS_MELODIES,
          play: id => playSuccessSound(id, { preview: true }),
          onChange: id => { s.successSound = id; save(); },
        }),
        melodyPickerField({
          label: 'Неверно',
          value: normalizeFailSoundId(s.failSound),
          melodies: FAIL_MELODIES,
          play: id => playFailSound(id, { preview: true }),
          onChange: id => { s.failSound = id; save(); },
        }),
        melodyPickerField({
          label: 'Кубок',
          value: normalizeCupMelodyId(s.cupMelody),
          melodies: CUP_MELODIES,
          play: id => playCupMelody(id, { preview: true }),
          onChange: id => { s.cupMelody = id; save(); },
        }),
      ]),
      el('div', { class: 'setting-row sound-mode-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, 'Озвучивать'),
          el('span', null, 'Когда проигрывать выбранные мелодии.'),
        ]),
        segControl(normalizeAnswerSoundMode(s.answerSoundMode), [
          { v: 'both', label: 'Оба' },
          { v: 'correct', label: 'Верный' },
          { v: 'wrong', label: 'Неверный' },
          { v: 'none', label: 'Выкл' },
        ], v => { s.answerSoundMode = v; save(); }),
      ]),
    ]),
  ]);
}
