import { el, modal } from '../../ui/ui.js';
import { nav } from '../../ui/navigation.js';
import { store } from '../../core/state.js';
import {
  STUDY_MODE_META, PROMPT_SIDE_META, buildReviewHash,
  getLastStudyMode, setLastStudyMode, setSessionStudyMode,
  getLastPromptSide, setSessionPromptSide, normalizePromptSide,
  getLastCramLimit, setSessionCramLimit,
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

function limitPickerBlock(totalCards, initialLimit, onChange) {
  const presets = [
    { label: 'Все', value: 'all' },
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 },
  ].filter(p => p.value === 'all' || p.value <= totalCards);

  let choice = initialLimit == null ? 'all'
    : presets.some(p => p.value === initialLimit) ? initialLimit
      : 'custom';
  let customN = choice === 'custom' && initialLimit ? String(initialLimit) : '';

  const seg = el('div', { class: 'seg mode-pick-side-seg mode-pick-limit-seg' });
  const customCell = el('div', { class: 'mode-pick-limit-other' });
  const customInput = el('input', {
    type: 'number',
    class: 'mode-pick-limit-input',
    min: '1',
    max: String(totalCards),
    placeholder: 'Другое',
    inputmode: 'numeric',
    'aria-label': `Другое количество, от 1 до ${totalCards}`,
  });

  function resolveLimit() {
    if (choice === 'all') return null;
    if (choice === 'custom') {
      const n = parseInt(customInput.value || customN, 10);
      if (!Number.isFinite(n) || n < 1) return null;
      return Math.min(n, totalCards);
    }
    return choice;
  }

  function refresh() {
    btns.forEach(b => b.classList.toggle('active', b.dataset.limit === String(choice)));
    customCell.classList.toggle('active', choice === 'custom');
    customInput.max = String(totalCards);
    if (choice === 'custom' && customN && !customInput.value) customInput.value = customN;
    if (choice !== 'custom') customInput.value = '';
    onChange(resolveLimit());
  }

  const btns = [];
  presets.forEach(p => {
    const btn = el('button', {
      type: 'button',
      'data-limit': String(p.value),
      onclick: () => { choice = p.value; customN = ''; refresh(); },
    }, p.label);
    btns.push(btn);
    seg.append(btn);
  });

  customInput.addEventListener('focus', () => {
    choice = 'custom';
    refresh();
  });
  customInput.addEventListener('input', () => {
    choice = 'custom';
    customN = customInput.value;
    btns.forEach(b => b.classList.remove('active'));
    customCell.classList.add('active');
    onChange(resolveLimit());
  });

  customCell.append(customInput);
  seg.append(customCell);

  if (choice === 'custom' && customN) customInput.value = customN;

  refresh();
  const block = el('div', { class: 'mode-pick-side-block mode-pick-limit-block' }, [
    el('p', { class: 'modal-text mode-pick-side-label' }, [
      'Сколько слов за раз? ',
      el('span', { class: 'muted' }, `(в папке ${totalCards})`),
    ]),
    seg,
  ]);
  block.getLimit = resolveLimit;
  return block;
}

export async function studyModePicker({ folderId = null, cram = false } = {}) {
  const last = getLastStudyMode();
  let chosenSide = getLastPromptSide();
  let chosenLimit = getLastCramLimit();
  let cardCount = null;

  if (cram && folderId) {
    cardCount = await store.countCards(folderId);
  }

  let m;
  const sideBlock = cram ? sidePickerBlock(chosenSide, s => { chosenSide = s; }) : null;
  const limitBlock = cram && cardCount
    ? limitPickerBlock(cardCount, chosenLimit, l => { chosenLimit = l; })
    : null;

  const items = STUDY_MODE_META.map(meta => {
    const needsSpeech = meta.id === 'voice';
    const disabled = needsSpeech && !speechRecognitionSupported();
    const btn = el('button', {
      type: 'button',
      class: 'mode-pick-item' + (meta.id === last ? ' is-last' : '') + (disabled ? ' is-disabled' : ''),
      disabled,
      onclick: () => {
        if (limitBlock?.getLimit) chosenLimit = limitBlock.getLimit();
        if (cram && limitBlock && chosenLimit == null
          && limitBlock.querySelector('.mode-pick-limit-other')?.classList.contains('active')) {
          const inp = limitBlock.querySelector('.mode-pick-limit-input');
          const n = parseInt(inp?.value, 10);
          if (!Number.isFinite(n) || n < 1) {
            inp?.focus();
            return;
          }
          chosenLimit = Math.min(n, cardCount);
        }
        setLastStudyMode(meta.id);
        setSessionStudyMode(meta.id);
        if (cram) {
          setSessionPromptSide(chosenSide);
          setSessionCramLimit(chosenLimit);
        }
        const hash = buildReviewHash(folderId, { cram, mode: meta.id, cramLimit: chosenLimit });
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
      ? 'Выберите сторону, сколько слов повторить и способ закрепления.'
      : 'Выберите, как хотите повторять карточки в этой сессии.'),
    sideBlock,
    limitBlock,
    cram ? el('p', { class: 'modal-text mode-pick-modes-label' }, 'Способ закрепления') : null,
    el('div', { class: 'mode-pick-grid' }, items),
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
    ]),
  ]));
}
