import type { SrsCard } from "../../../lib/srs.js";
import type { Settings } from "../../../lib/sounds.js";
import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { checkCardAnswer, formatExpectedDisplay } from '../../../lib/answer-check.js';
import { playAnswerFeedback, unlockAnswerAudio } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback, pulseStudyInput } from '../../../ui/answer-feedback.js';
import { haptic } from '../../../ui/helpers.js';
import { focusWithoutScroll } from '../../../lib/study-keyboard.js';


interface TypeModeCtx {
  promptSide: 'front' | 'back';
  onSuccess: (r: { firstTry: boolean }) => void;
  onFail: (r?: { firstTry?: boolean }) => void;
  getSettings: () => Settings | null;
}

function buildPrompt(card: SrsCard, promptSide: 'front' | 'back') {
  return el('div', { class: 'study-prompt-card' }, [
    buildFaceScroll(promptSide, card),
  ]);
}

export function createTypeModeCard(card: SrsCard, ctx: TypeModeCtx) {
  const { promptSide, onSuccess, onFail, getSettings } = ctx;
  let answered = false;
  let attempts = 0;

  const prompt = buildPrompt(card, promptSide);
  const input = el('input', {
    type: 'text',
    class: 'input study-answer-input',
    placeholder: promptSide === 'front' ? 'Введите перевод…' : 'Введите термин…',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  }, undefined) as HTMLInputElement;

  const feedback = el('div', { class: 'study-feedback', hidden: true }, undefined);
  const actions = el('div', { class: 'study-actions' }, undefined);
  const checkBtn = el('button', { type: 'button', class: 'btn primary study-check-btn' }, 'Проверить') as HTMLButtonElement;

  function playFeedback(isCorrect: boolean) {
    playAnswerFeedback(isCorrect, getSettings?.());
  }

  function setState(state: string) {
    input.classList.remove('is-correct', 'is-wrong', 'is-animating');
    if (state === 'correct') input.classList.add('is-correct');
    if (state === 'wrong') input.classList.add('is-wrong');
  }

  function showWrong(expected: string) {
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
    const { ok, expected } = checkCardAnswer(input.value, card, promptSide, { fuzzy: true });
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
      showWrong(expected);
      focusWithoutScroll(input);
    }
  }

  checkBtn.addEventListener('click', check);
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); check(); }
  });
  input.addEventListener('input', () => {
    if (input.classList.contains('is-wrong')) {
      setState('');
      feedback.hidden = true;
    }
  });

  actions.append(checkBtn);

  const box = el('div', { class: 'study-type-card' }, [
    prompt,
    el('p', { class: 'study-hint' }, 'Введите ответ и нажмите «Проверить»'),
    input,
    feedback,
    actions,
  ]);

  return {
    box,
    getPromptSide: () => promptSide,
    destroy() {},
  };
}
