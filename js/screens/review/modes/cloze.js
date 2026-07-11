import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { checkCardAnswer, formatExpectedDisplay, getExpectedAnswer } from '../../../lib/answer-check.js';
import { buildClozeText, clozeSeed } from '../../../lib/cloze.js';
import { playAnswerFeedback, unlockAnswerAudio } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback, pulseStudyInput } from '../../../ui/answer-feedback.js';
import { haptic } from '../../../ui/helpers.js';

function buildPrompt(card, promptSide) {
  return el('div', { class: 'study-prompt-card' }, [
    buildFaceScroll(promptSide, card),
  ]);
}

function renderClozeSegments(segments) {
  return el('div', { class: 'study-cloze-text', 'aria-label': 'Слово с пропусками' },
    segments.map(seg => {
      if (seg.hidden) {
        return el('span', { class: 'study-cloze-blank' }, '_');
      }
      return document.createTextNode(seg.ch);
    }),
  );
}

export function createClozeModeCard(card, ctx) {
  const { promptSide, onSuccess, onFail, getSettings } = ctx;
  let answered = false;
  let attempts = 0;

  const expected = getExpectedAnswer(card, promptSide);
  const cloze = buildClozeText(expected, { seed: clozeSeed(expected, card.id) });

  const prompt = buildPrompt(card, promptSide);
  const clozeEl = renderClozeSegments(cloze.segments);

  const input = el('input', {
    type: 'text',
    class: 'input study-answer-input',
    placeholder: promptSide === 'front' ? 'Введите слово целиком…' : 'Введите термин целиком…',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });

  const feedback = el('div', { class: 'study-feedback', hidden: true });
  const actions = el('div', { class: 'study-actions' });
  const checkBtn = el('button', { type: 'button', class: 'btn primary study-check-btn' }, 'Проверить');

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
      showStudyFeedback(feedback, false, 'Правильно: ' + formatExpectedDisplay(expected));
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
    const { ok } = checkCardAnswer(input.value, card, promptSide, { fuzzy: true });
    if (ok) {
      answered = true;
      playFeedback(true);
      haptic(10);
      pulseStudyInput(input, true);
      flashStudyCard(prompt, true);
      showStudyFeedback(feedback, true, 'Верно!');
      input.disabled = true;
      checkBtn.disabled = true;
      setTimeout(() => onSuccess({ firstTry }), 560);
    } else {
      playFeedback(false);
      haptic(4);
      pulseStudyInput(input, false);
      flashStudyCard(prompt, false);
      showWrong();
      input.focus();
    }
  }

  checkBtn.addEventListener('click', check);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); check(); }
  });
  input.addEventListener('input', () => {
    if (input.classList.contains('is-wrong')) {
      input.classList.remove('is-wrong', 'is-animating');
      feedback.hidden = true;
    }
  });

  actions.append(checkBtn);

  const box = el('div', { class: 'study-cloze-card' }, [
    prompt,
    el('p', { class: 'study-hint' }, 'Допишите пропущенные буквы — введите слово или фразу целиком'),
    clozeEl,
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
