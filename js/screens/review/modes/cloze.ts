import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { getExpectedAnswer } from '../../../lib/answer-check.js';
import {
  buildClozeText,
  checkClozeAnswer,
  clozeSeed,
  formatClozeReveal,
} from '../../../lib/cloze.js';
import { playAnswerFeedback, unlockAnswerAudio } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback, pulseStudyInput } from '../../../ui/answer-feedback.js';
import { haptic } from '../../../ui/helpers.js';
import { focusWithoutScroll } from '../../../lib/study-keyboard.js';

function focusClozeInput(inp) {
  if (inp) focusWithoutScroll(inp);
}

function buildPrompt(card, promptSide) {
  return el('div', { class: 'study-prompt-card' }, [
    buildFaceScroll(promptSide, card),
  ]);
}

function renderClozeSegments(cloze) {
  const inputs = [];
  const label = cloze.mode === 'words' ? 'Фраза с пропусками' : 'Слово с пропусками';

  const children = cloze.segments.map(seg => {
    if (seg.type === 'blank') {
      const inp = el('input', {
        type: 'text',
        class: 'study-cloze-inline study-cloze-inline-word',
        'aria-label': 'Пропущенное слово',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        size: String(Math.max(seg.answer.length, 3)),
      });
      inputs.push({ inp, kind: 'word' });
      return inp;
    }
    if (seg.hidden) {
      const inp = el('input', {
        type: 'text',
        class: 'study-cloze-inline study-cloze-inline-letter',
        'aria-label': 'Пропущенная буква',
        maxlength: '1',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        size: '1',
      });
      inputs.push({ inp, kind: 'letter' });
      return inp;
    }
    if (seg.type === 'text') return document.createTextNode(seg.text);
    return document.createTextNode(seg.ch);
  });

  return {
    el: el('div', { class: 'study-cloze-text', 'aria-label': label }, children),
    inputs,
  };
}

function collectClozeInputValue(inputs, cloze) {
  if (cloze.mode === 'words') {
    return inputs
      .filter(i => i.kind === 'word')
      .map(i => i.inp.value)
      .join(' ');
  }
  return inputs
    .filter(i => i.kind === 'letter')
    .map(i => i.inp.value)
    .join('');
}

function wireClozeInputs(inputs, { onSubmit, onEdit }) {
  const list = inputs.map(i => i.inp);

  list.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      onEdit?.();

      if (inputs[idx].kind !== 'letter') return;

      const chars = [...inp.value];
      if (chars.length <= 1) {
        if (chars[0] && idx < list.length - 1) focusClozeInput(list[idx + 1]);
        return;
      }

      inp.value = chars[0];
      let charIdx = 1;
      let pos = idx + 1;
      while (charIdx < chars.length && pos < list.length) {
        if (inputs[pos].kind === 'letter') list[pos].value = chars[charIdx++];
        pos++;
      }
      const nextEmpty = list.findIndex((node, i) => i > idx && inputs[i].kind === 'letter' && !node.value);
      if (nextEmpty >= 0) focusClozeInput(list[nextEmpty]);
      else focusClozeInput(list[Math.min(pos, list.length - 1)]);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && idx > 0) {
        e.preventDefault();
        focusClozeInput(list[idx - 1]);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    });
  });
}

function setClozeInputsDisabled(inputs, disabled) {
  for (const { inp } of inputs) inp.disabled = disabled;
}

function pulseClozeInputs(inputs, isCorrect) {
  for (const { inp } of inputs) pulseStudyInput(inp, isCorrect);
}

export function createClozeModeCard(card, ctx) {
  const { promptSide, onSuccess, onFail, getSettings } = ctx;
  let answered = false;
  let attempts = 0;

  const expected = getExpectedAnswer(card, promptSide);
  const promptText = getExpectedAnswer(card, promptSide === 'front' ? 'back' : 'front');
  const clozeOpts = { seed: clozeSeed(expected, card.id), promptText };
  const cloze = buildClozeText(expected, clozeOpts);
  const isPhrase = cloze.mode === 'words';

  const prompt = buildPrompt(card, promptSide);
  const { el: clozeEl, inputs: clozeInputs } = renderClozeSegments(cloze);

  const feedback = el('div', { class: 'study-feedback', hidden: true });
  const actions = el('div', { class: 'study-actions' });
  const checkBtn = el('button', { type: 'button', class: 'btn primary study-check-btn' }, 'Проверить');

  function clearWrongState() {
    for (const { inp } of clozeInputs) {
      inp.classList.remove('is-wrong', 'is-correct', 'is-animating');
    }
    feedback.hidden = true;
  }

  function playFeedback(isCorrect) {
    playAnswerFeedback(isCorrect, getSettings?.());
  }

  function showWrong() {
    showStudyFeedback(feedback, false, 'Неверно');
    actions.innerHTML = '';
    const revealBtn = el('button', {
      type: 'button',
      class: 'btn ghost study-reveal-btn',
    }, 'Показать ответ');
    revealBtn.addEventListener('click', () => {
      const reveal = formatClozeReveal(cloze);
      showStudyFeedback(feedback, false, 'Правильно: ' + reveal);
      revealBtn.remove();
    });
    checkBtn.disabled = false;
    actions.append(
      checkBtn,
      revealBtn,
      el('button', {
        type: 'button',
        class: 'btn ghost',
        onclick: () => { if (!answered) { answered = true; onFail({ firstTry: false }); } },
      }, 'Не знаю'),
    );
  }

  function check() {
    if (answered) return;
    const settings = getSettings?.();
    if (settings) unlockAnswerAudio(settings);
    attempts++;
    const firstTry = attempts === 1;
    const value = collectClozeInputValue(clozeInputs, cloze);
    const { ok } = checkClozeAnswer(value, cloze);
    if (ok) {
      answered = true;
      playFeedback(true);
      haptic(10);
      pulseClozeInputs(clozeInputs, true);
      flashStudyCard(prompt, true);
      showStudyFeedback(feedback, true, 'Верно!');
      setClozeInputsDisabled(clozeInputs, true);
      checkBtn.disabled = true;
      setTimeout(() => onSuccess({ firstTry }), 560);
    } else {
      playFeedback(false);
      haptic(4);
      pulseClozeInputs(clozeInputs, false);
      flashStudyCard(prompt, false);
      showWrong();
      const first = clozeInputs.find(i => !i.inp.disabled)?.inp;
      focusClozeInput(first);
    }
  }

  checkBtn.addEventListener('click', check);
  wireClozeInputs(clozeInputs, { onSubmit: check, onEdit: clearWrongState });

  actions.append(checkBtn);

  const hint = isPhrase
    ? 'Допишите пропущенные слова прямо в тексте — только их, не всю фразу'
    : 'Допишите пропущенные буквы прямо в слове — только их, не слово целиком';

  const box = el('div', { class: 'study-cloze-card' }, [
    prompt,
    el('p', { class: 'study-hint' }, hint),
    clozeEl,
    feedback,
    actions,
  ]);

  return {
    box,
    getPromptSide: () => promptSide,
    destroy() {},
  };
}
