import { el } from '../../../ui/ui.js';
import { t } from '../../../lib/i18n.js';
import {
  SUCCESS_MELODIES, FAIL_MELODIES, CUP_MELODIES, UI_CLICK_MELODIES,
  playSuccessSound, playFailSound, playCupMelody, playUiClickSound,
  normalizeSuccessSoundId, normalizeFailSoundId, normalizeAnswerSoundMode,
  normalizeCupMelodyId, normalizeUiClickSoundId,
} from '../../../lib/sounds.js';
import { melodyPickerField } from '../../../ui/melody-picker.js';
import { segControl } from '../shared.js';

interface SettingsLike {
  uiClickSound?: string;
  successSound?: string;
  failSound?: string;
  cupMelody?: string;
  answerSoundMode?: string;
}

export function buildSoundGroup(s: SettingsLike, save: () => void) {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.sounds.title')),
    el('div', { class: 'setting-row setting-row-stack sound-settings-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.sounds.uiClicks')),
        el('span', null, t('settings.sounds.uiClicksHint')),
      ]),
      el('div', { class: 'sound-pickers' }, [
        melodyPickerField({
          label: t('settings.sounds.uiClicksLabel'),
          value: normalizeUiClickSoundId(s.uiClickSound ?? ''),
          melodies: UI_CLICK_MELODIES,
          play: id => { if (id !== 'none') playUiClickSound(id, { preview: true }); },
          onChange: id => { s.uiClickSound = id; save(); },
        }),
      ]),
    ]),
    el('div', { class: 'setting-row setting-row-stack sound-settings-compact' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.sounds.answerMelodies')),
        el('span', null, t('settings.sounds.answerMelodiesHint')),
      ]),
      el('div', { class: 'sound-pickers' }, [
        melodyPickerField({
          label: t('settings.sounds.correct'),
          value: normalizeSuccessSoundId(s.successSound ?? ''),
          melodies: SUCCESS_MELODIES,
          play: id => playSuccessSound(id, { preview: true }),
          onChange: id => { s.successSound = id; save(); },
        }),
        melodyPickerField({
          label: t('settings.sounds.wrong'),
          value: normalizeFailSoundId(s.failSound ?? ''),
          melodies: FAIL_MELODIES,
          play: id => playFailSound(id, { preview: true }),
          onChange: id => { s.failSound = id; save(); },
        }),
        melodyPickerField({
          label: t('settings.sounds.cup'),
          value: normalizeCupMelodyId(s.cupMelody ?? ''),
          melodies: CUP_MELODIES,
          play: id => playCupMelody(id, { preview: true }),
          onChange: id => { s.cupMelody = id; save(); },
        }),
      ]),
      el('div', { class: 'setting-row sound-mode-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, t('settings.sounds.playWhen')),
          el('span', null, t('settings.sounds.playWhenHint')),
        ]),
        segControl(normalizeAnswerSoundMode(s.answerSoundMode ?? ''), [
          { v: 'both', label: t('settings.sounds.modeBoth') },
          { v: 'correct', label: t('settings.sounds.modeCorrect') },
          { v: 'wrong', label: t('settings.sounds.modeWrong') },
          { v: 'none', label: t('settings.sounds.modeNone') },
        ], v => { s.answerSoundMode = v; save(); }),
      ]),
    ]),
  ]);
}
