import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { detectSpeechLang, haptic } from '../../../ui/helpers.js';
import { playAnswerFeedback, unlockAnswerAudio } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback } from '../../../ui/answer-feedback.js';
import { checkCardAnswer, getExpectedAnswer, formatExpectedDisplay, expectedVariants } from '../../../lib/answer-check.js';
import { listenOnce, speechRecognitionSupported } from '../../../lib/speech-input.js';
import { isSpaceKey, shouldStartVoiceFromSpace } from '../../../lib/voice-keyboard.js';

const LABEL_START = '🎤 Сказать ответ';
const LABEL_CHECK = '✓ Проверить';

function buildPrompt(card, promptSide) {
  return el('div', { class: 'study-prompt-card' }, [
    buildFaceScroll(promptSide, card),
  ]);
}

export function createVoiceModeCard(card, ctx) {
  const { promptSide, onSuccess, onFail, getSettings } = ctx;
  let answered = false;
  let listens = 0;
  let stopListen = null;
  let listening = false;
  let stopping = false;

  const prompt = buildPrompt(card, promptSide);
  const status = el('p', { class: 'study-voice-status muted' }, 'Пробел или кнопка — начать запись');
  const heard = el('div', { class: 'study-feedback', hidden: true });
  const actions = el('div', { class: 'study-actions study-voice-actions' });

  const startBtn = el('button', {
    type: 'button',
    class: 'btn accent study-mic-btn',
    disabled: !speechRecognitionSupported(),
  }, LABEL_START);

  const checkBtn = el('button', {
    type: 'button',
    class: 'btn primary study-check-btn',
    hidden: true,
  }, LABEL_CHECK);

  function setUiIdle() {
    listening = false;
    stopping = false;
    startBtn.hidden = false;
    checkBtn.hidden = true;
    checkBtn.classList.remove('is-listening');
    startBtn.disabled = answered || !speechRecognitionSupported();
    checkBtn.disabled = false;
    checkBtn.removeAttribute('disabled');
  }

  function setUiListening() {
    listening = true;
    stopping = false;
    startBtn.hidden = true;
    checkBtn.hidden = false;
    checkBtn.classList.add('is-listening');
    checkBtn.disabled = false;
    checkBtn.removeAttribute('disabled');
  }

  function playFeedback(isCorrect) {
    const settings = getSettings?.();
    if (!settings) return;
    const run = () => playAnswerFeedback(isCorrect, settings);
    if (isCorrect) run();
    else setTimeout(run, 120);
  }

  function cleanupListen() {
    if (stopListen) {
      const fn = stopListen;
      stopListen = null;
      fn();
    }
    setUiIdle();
  }

  function evaluateTranscript(transcript) {
    stopListen = null;
    stopping = false;
    setUiIdle();
    status.textContent = '';
    if (!transcript?.trim()) {
      status.textContent = 'Речь не распознана — скажите ответ и нажмите «Проверить»';
      heard.hidden = true;
      return;
    }
    listens++;
    const firstTry = listens === 1;
    const expected = getExpectedAnswer(card, promptSide);
    const { ok } = checkCardAnswer(transcript, card, promptSide, { fuzzy: true, fuzzyThreshold: 0.75 });
    if (ok) {
      answered = true;
      startBtn.disabled = true;
      playFeedback(true);
      haptic(12);
      flashStudyCard(prompt, true);
      showStudyFeedback(heard, true, 'Верно!');
      setTimeout(() => onSuccess({ firstTry }), 580);
    } else {
      playFeedback(false);
      haptic(4);
      showWrong(transcript, expected);
    }
  }

  function showWrong(transcript, expected) {
    flashStudyCard(prompt, false);
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
          if (!answered) { answered = true; onFail({ firstTry: false }); }
        },
      }, 'Не знаю'),
    );
  }

  function finishListen() {
    if (!listening || answered || stopping) return;
    stopping = true;
    checkBtn.textContent = '…';
    stopListen?.();
  }

  function resetListenUi() {
    stopListen = null;
    stopping = false;
    checkBtn.textContent = LABEL_CHECK;
    setUiIdle();
  }

  function startListen() {
    if (answered || listening || !speechRecognitionSupported()) return;
    const settings = getSettings?.();
    if (settings) unlockAnswerAudio(settings);
    if (stopListen) cleanupListen();

    if (!actions.contains(startBtn)) {
      actions.innerHTML = '';
      actions.append(startBtn, checkBtn);
    }

    const expected = getExpectedAnswer(card, promptSide);
    const lang = detectSpeechLang(expected);
    status.textContent = 'Слушаю…';
    heard.hidden = true;
    setUiListening();

    stopListen = listenOnce({
      lang,
      manualStop: true,
      contextualStrings: expectedVariants(expected),
      onInterim: (text) => {
        status.textContent = `Слушаю: «${text}»`;
      },
      onResult: evaluateTranscript,
      onError: (err) => {
        resetListenUi();
        status.textContent = err.message;
      },
      onEnd: () => {
        if (!answered && listening && !stopping) {
          resetListenUi();
          status.textContent = 'Запись остановлена — нажмите «Сказать ответ»';
        } else if (stopping) {
          checkBtn.textContent = LABEL_CHECK;
        }
      },
    });
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startListen();
  });
  checkBtn.addEventListener('click', (e) => {
    e.preventDefault();
    finishListen();
  });

  const onVoiceKey = (e) => {
    if (!isSpaceKey(e)) return;
    e.preventDefault();
    if (listening) finishListen();
    else startListen();
  };
  startBtn.addEventListener('keydown', onVoiceKey);
  checkBtn.addEventListener('keydown', onVoiceKey);

  actions.append(startBtn, checkBtn);

  const box = el('div', { class: 'study-voice-card', tabindex: '-1' }, [
    prompt,
    status,
    heard,
    actions,
  ]);

  const onKey = (e) => {
    if (!document.body.contains(box)) {
      document.removeEventListener('keydown', onKey, true);
      return;
    }
    if (!shouldStartVoiceFromSpace(e, box)) return;
    e.preventDefault();
    if (listening) finishListen();
    else startListen();
  };
  document.addEventListener('keydown', onKey, true);

  requestAnimationFrame(() => {
    if (document.body.contains(box)) box.focus({ preventScroll: true });
  });

  if (!speechRecognitionSupported()) {
    status.textContent = 'Голосовой режим недоступен — используйте ввод текста';
  }

  return {
    box,
    getPromptSide: () => promptSide,
    destroy() {
      document.removeEventListener('keydown', onKey, true);
      if (stopListen) {
        const fn = stopListen;
        stopListen = null;
        fn();
      }
      listening = false;
      stopping = false;
    },
  };
}
