import { el, modal } from '../../ui/ui.js';
import { nav } from '../../ui/shell.js';
import {
  STUDY_MODE_META, PROMPT_SIDE_META, buildReviewHash,
  getLastStudyMode, setLastStudyMode, setSessionStudyMode,
  getLastPromptSide, setSessionPromptSide, normalizePromptSide,
} from '../../lib/study-modes.js';
import { speechRecognitionSupported } from '../../lib/speech-input.js';

function sidePickerBlock(initialSide, onChange) {
  let side = normalizePromptSide(initialSide);
  const hint = el('p', { class: 'mode-pick-side-hint' }, '');
  const seg = el('div', { class: 'seg mode-pick-side-seg' });
  const btns = [];

  function refresh() {
    const meta = PROMPT_SIDE_META.find(s => s.id === side) || PROMPT_SIDE_META[0];
    hint.textContent = meta.desc;
    btns.forEach(b => b.classList.toggle('active', b.dataset.side === side));
    onChange(side);
  }

  PROMPT_SIDE_META.forEach(meta => {
    const btn = el('button', {
      type: 'button',
      'data-side': meta.id,
      onclick: () => { side = meta.id; refresh(); },
    }, meta.label);
    btns.push(btn);
    seg.append(btn);
  });

  refresh();
  return el('div', { class: 'mode-pick-side-block' }, [
    el('p', { class: 'modal-text mode-pick-side-label' }, 'Что показывать на карточке?'),
    seg,
    hint,
  ]);
}

export function studyModePicker({ folderId = null, cram = false } = {}) {
  const last = getLastStudyMode();
  let chosenSide = getLastPromptSide();
  let m;

  const sideBlock = cram ? sidePickerBlock(chosenSide, s => { chosenSide = s; }) : null;

  const items = STUDY_MODE_META.map(meta => {
    const disabled = meta.id === 'voice' && !speechRecognitionSupported();
    const btn = el('button', {
      type: 'button',
      class: 'mode-pick-item' + (meta.id === last ? ' is-last' : '') + (disabled ? ' is-disabled' : ''),
      disabled,
      onclick: () => {
        setLastStudyMode(meta.id);
        setSessionStudyMode(meta.id);
        if (cram) setSessionPromptSide(chosenSide);
        const hash = buildReviewHash(folderId, { cram, mode: meta.id });
        m.close();
        requestAnimationFrame(() => nav(hash));
      },
    }, [
      el('span', { class: 'mode-pick-title' }, meta.title),
      el('span', { class: 'mode-pick-desc' }, disabled
        ? 'Недоступно в этом браузере'
        : meta.desc),
    ]);
    return btn;
  });

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, cram ? 'Закрепление папки' : 'Режим повторения'),
    el('p', { class: 'modal-text' }, cram
      ? 'Выберите сторону карточки и способ закрепления.'
      : 'Выберите, как хотите повторять карточки в этой сессии.'),
    sideBlock,
    cram ? el('p', { class: 'modal-text mode-pick-modes-label' }, 'Способ закрепления') : null,
    el('div', { class: 'mode-pick-grid' }, items),
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
    ]),
  ]));
}
