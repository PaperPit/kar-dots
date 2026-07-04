import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { detectSpeechLang, haptic } from '../../../ui/helpers.js';
import { playAnswerFeedbackFromStore } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback } from '../../../ui/answer-feedback.js';
import { checkCardAnswer, getExpectedAnswer, formatExpectedDisplay } from '../../../lib/answer-check.js';
import { listenOnce, speechRecognitionSupported } from '../../../lib/speech-input.js';

function buildPrompt(card, promptSide) {
  return el('div', { class: 'study-prompt-card' }, [
    el('div', { class: 'side-label' }, promptSide === 'front' ? 'лицо' : 'оборот'),
    buildFaceScroll(promptSide, card),
  ]);
}

function isTextEntryTarget(node) {
  if (!node || !(node instanceof Element)) return false;
  if (node.closest('.modal-overlay')) return true;
  const tag = node.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (node.isContentEditable) return true;
  return !!node.closest('[contenteditable="true"]');
}

export function createVoiceModeCard(card, ctx) {
  const { promptSide, onSuccess, onFail } = ctx;
  let answered = false;
  let stopListen = null;
  let listening = false;

  const status = el('p', { class: 'study-voice-status muted' }, 'Пробел или кнопка — начать запись');
  const heard = el('div', { class: 'study-feedback', hidden: true });
  const actions = el('div', { class: 'study-actions study-voice-actions' });

  const micBtn = el('button', {
    type: 'button',
    class: 'btn accent study-mic-btn',
    disabled: !speechRecognitionSupported(),
  }, '🎤 Сказать ответ');

  function cleanupListen() {
    if (stopListen) { stopListen(); stopListen = null; }
    listening = false;
    micBtn.classList.remove('is-listening');
    micBtn.disabled = answered || !speechRecognitionSupported();
  }

  function showWrong(transcript, expected) {
    flashStudyCard(box, false);
    showStudyFeedback(heard, false, transcript ? `Услышано: «${transcript}»` : 'Неверно');
    actions.innerHTML = '';
    const revealBtn = el('button', {
      type: 'button',
      class: 'btn ghost study-reveal-btn',
    }, 'Показать ответ');
    revealBtn.addEventListener('click', () => {
      const display = formatExpectedDisplay(expected);
      showStudyFeedback(heard, false, transcript
        ? `Услышано: «${transcript}». Правильно: ${display}`
        : `Правильно: ${display}`);
      revealBtn.remove();
    });
    actions.append(
      el('button', {
        type: 'button',
        class: 'btn accent study-mic-btn',
        onclick: () => startListen(),
      }, '🎤 Попробовать снова'),
      revealBtn,
      el('button', {
        type: 'button',
        class: 'btn ghost',
        onclick: () => {
          cleanupListen();
          if (!answered) { answered = true; onFail(); }
        },
      }, 'Не знаю'),
    );
  }

  function startListen() {
    if (answered || listening || !speechRecognitionSupported()) return;
    cleanupListen();
    const expected = getExpectedAnswer(card, promptSide);
    const lang = detectSpeechLang(expected);
    status.textContent = 'Слушаю…';
    listening = true;
    micBtn.classList.add('is-listening');
    micBtn.disabled = true;
    heard.hidden = true;
    actions.innerHTML = '';
    actions.append(micBtn);

    stopListen = listenOnce({
      lang,
      onResult: (transcript) => {
        cleanupListen();
        status.textContent = '';
        const { ok } = checkCardAnswer(transcript, card, promptSide, { fuzzy: true, fuzzyThreshold: 0.75 });
        if (ok) {
          answered = true;
          playAnswerFeedbackFromStore(true);
          haptic(12);
          flashStudyCard(box, true);
          showStudyFeedback(heard, true, 'Верно!');
          setTimeout(() => onSuccess(), 580);
        } else {
          playAnswerFeedbackFromStore(false);
          haptic(4);
          showWrong(transcript, expected);
        }
      },
      onError: (err) => {
        cleanupListen();
        status.textContent = err.message;
        micBtn.disabled = false;
        actions.innerHTML = '';
        actions.append(micBtn);
      },
      onEnd: () => {
        if (!answered && listening) {
          cleanupListen();
          status.textContent = 'Пробел или кнопка — начать запись';
          micBtn.disabled = false;
        }
      },
    });
  }

  micBtn.addEventListener('click', startListen);
  actions.append(micBtn);

  const box = el('div', { class: 'study-voice-card' }, [
    buildPrompt(card, promptSide),
    status,
    heard,
    actions,
  ]);

  const onKey = (e) => {
    if (!document.body.contains(box)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (isTextEntryTarget(e.target)) return;
    if (e.key !== ' ' && e.code !== 'Space') return;
    e.preventDefault();
    startListen();
  };
  document.addEventListener('keydown', onKey);

  if (!speechRecognitionSupported()) {
    status.textContent = 'Голосовой режим недоступен — используйте ввод текста';
  }

  return {
    box,
    getPromptSide: () => promptSide,
    destroy() {
      document.removeEventListener('keydown', onKey);
      cleanupListen();
    },
  };
}
