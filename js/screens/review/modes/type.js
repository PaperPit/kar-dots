import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { checkCardAnswer, formatExpectedDisplay } from '../../../lib/answer-check.js';
import { playAnswerFeedbackFromStore } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback, pulseStudyInput } from '../../../ui/answer-feedback.js';
import { haptic } from '../../../ui/helpers.js';

function buildPrompt(card, promptSide) {
  return el('div', { class: 'study-prompt-card' }, [
    el('div', { class: 'side-label' }, promptSide === 'front' ? 'лицо' : 'оборот'),
    buildFaceScroll(promptSide, card),
  ]);
}

export function createTypeModeCard(card, ctx) {
  const { promptSide, onSuccess, onFail } = ctx;
  let answered = false;

  const input = el('input', {
    type: 'text',
    class: 'input study-answer-input',
    placeholder: promptSide === 'front' ? 'Введите перевод…' : 'Введите термин…',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });

  const feedback = el('div', { class: 'study-feedback', hidden: true });
  const actions = el('div', { class: 'study-actions' });
  const checkBtn = el('button', { type: 'button', class: 'btn primary study-check-btn' }, 'Проверить');

  function setState(state) {
    input.classList.remove('is-correct', 'is-wrong', 'is-animating');
    if (state === 'correct') input.classList.add('is-correct');
    if (state === 'wrong') input.classList.add('is-wrong');
  }

  function showWrong(expected) {
    showStudyFeedback(feedback, false, 'Неверно');
    actions.innerHTML = '';
    const revealBtn = el('button', {
      type: 'button',
      class: 'btn ghost study-reveal-btn',
    }, 'Показать ответ');
    revealBtn.addEventListener('click', () => {
      showStudyFeedback(feedback, false, 'Правильно: ' + formatExpectedDisplay(expected));
      revealBtn.remove();
    });
    actions.append(
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => {
          input.value = '';
          input.disabled = false;
          setState('');
          feedback.hidden = true;
          actions.innerHTML = '';
          actions.append(checkBtn);
          input.focus();
        },
      }, 'Попробовать снова'),
      revealBtn,
      el('button', {
        type: 'button',
        class: 'btn ghost',
        onclick: () => { if (!answered) { answered = true; onFail(); } },
      }, 'Не знаю'),
    );
  }

  function check() {
    if (answered) return;
    const { ok, expected } = checkCardAnswer(input.value, card, promptSide, { fuzzy: true });
    if (ok) {
      answered = true;
      playAnswerFeedbackFromStore(true);
      haptic(10);
      pulseStudyInput(input, true);
      flashStudyCard(box, true);
      showStudyFeedback(feedback, true, 'Верно!');
      input.disabled = true;
      checkBtn.disabled = true;
      setTimeout(() => onSuccess(), 560);
    } else {
      playAnswerFeedbackFromStore(false);
      haptic(4);
      pulseStudyInput(input, false);
      flashStudyCard(box, false);
      input.disabled = true;
      checkBtn.disabled = true;
      showWrong(expected);
    }
  }

  checkBtn.addEventListener('click', check);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); check(); }
  });

  actions.append(checkBtn);

  const box = el('div', { class: 'study-type-card' }, [
    buildPrompt(card, promptSide),
    el('p', { class: 'study-hint' }, 'Введите ответ и нажмите «Проверить»'),
    input,
    feedback,
    actions,
  ]);

  setTimeout(() => input.focus(), 120);

  return {
    box,
    getPromptSide: () => promptSide,
    destroy() {},
  };
}
