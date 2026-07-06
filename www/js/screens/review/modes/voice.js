import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { detectSpeechLang, haptic } from '../../../ui/helpers.js';
import { playAnswerFeedback, unlockAnswerAudio } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback } from '../../../ui/answer-feedback.js';
import { checkCardAnswer, getExpectedAnswer, formatExpectedDisplay } from '../../../lib/answer-check.js';
import { listenOnce, speechRecognitionSupported } from '../../../lib/speech-input.js';
import { isSpaceKey, shouldStartVoiceFromSpace } from '../../../lib/voice-keyboard.js';

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

  const prompt = buildPrompt(card, promptSide);
  const status = el('p', { class: 'study-voice-status muted' }, 'Пробел или кнопка — начать запись');
  const heard = el('div', { class: 'study-feedback', hidden: true });
  const actions = el('div', { class: 'study-actions study-voice-actions' });

  const micBtn = el('button', {
    type: 'button',
    class: 'btn accent study-mic-btn',
    disabled: !speechRecognitionSupported(),
  }, '🎤 Сказать ответ');

  function playFeedback(isCorrect) {
    const settings = getSettings?.();
    if (!settings) return;
    const run = () => playAnswerFeedback(isCorrect, settings);
    if (isCorrect) run();
    else setTimeout(run, 120);
  }

  function cleanupListen() {
    if (stopListen) { stopListen(); stopListen = null; }
    listening = false;
    micBtn.classList.remove('is-listening');
    micBtn.disabled = answered || !speechRecognitionSupported();
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

  function startListen() {
    if (answered || listening || !speechRecognitionSupported()) return;
    const settings = getSettings?.();
    if (settings) unlockAnswerAudio(settings);
    if (stopListen) cleanupListen();
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
        listens++;
        const firstTry = listens === 1;
        const { ok } = checkCardAnswer(transcript, card, promptSide, { fuzzy: true, fuzzyThreshold: 0.75 });
        if (ok) {
          answered = true;
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
  micBtn.addEventListener('keydown', (e) => {
    if (!isSpaceKey(e)) return;
    e.preventDefault();
    startListen();
  });
  actions.append(micBtn);

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
    startListen();
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
      cleanupListen();
    },
  };
}
