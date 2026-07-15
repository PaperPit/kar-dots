import { el } from '../../../ui/ui.js';
import { buildFaceScroll } from '../../../ui/card-face.js';
import { haptic } from '../../../ui/helpers.js';
import { stopAllSpeech } from '../../../ui/tts.js';
import { playAnswerFeedback, unlockAnswerAudio, stopAnswerAudio } from '../../../lib/sounds.js';
import { flashStudyCard, showStudyFeedback } from '../../../ui/answer-feedback.js';
import { checkCardAnswer, getExpectedAnswer, formatExpectedDisplay, expectedVariants } from '../../../lib/answer-check.js';
import { listenOnce, speechRecognitionSupported, resolveVoiceSpeechLang, releaseSpeechSession } from '../../../lib/speech-input.js';
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
  let autoCheckTriggered = false;

  const answerOpts = { fuzzy: true, fuzzyThreshold: 0.68 };

  /** iOS шлёт один и тот же partial каждые ~300 ms — debounce сбрасывал таймер бесконечно. */
  function maybeAutoCheck(transcript) {
    if (autoCheckTriggered || !listening || stopping || answered) return;
    const t = String(transcript || '').trim();
    if (!t || !checkCardAnswer(t, card, promptSide, answerOpts).ok) return;
    autoCheckTriggered = true;
    finishListen();
  }

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
    startBtn.style.display = '';
    checkBtn.style.display = 'none';
    checkBtn.classList.remove('is-listening');
    checkBtn.textContent = LABEL_CHECK;
    startBtn.disabled = answered || !speechRecognitionSupported();
    checkBtn.disabled = false;
    checkBtn.removeAttribute('disabled');
    showVoiceActions();
  }

  function hideVoiceActions() {
    startBtn.hidden = true;
    checkBtn.hidden = true;
    actions.classList.remove('is-action-visible');
    void actions.offsetWidth;
    actions.classList.add('is-action-hidden');
  }

  function showVoiceActions() {
    actions.classList.remove('is-action-hidden');
    actions.classList.add('is-action-enter', 'is-action-visible');
  }

  function setUiListening() {
    listening = true;
    stopping = false;
    startBtn.hidden = true;
    checkBtn.hidden = false;
    startBtn.style.display = 'none';
    checkBtn.style.display = '';
    checkBtn.classList.add('is-listening');
    checkBtn.textContent = LABEL_CHECK;
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

  async function cleanupListen(silent = true) {
    const fn = stopListen;
    stopListen = null;
    if (fn) await fn({ cancel: silent }).catch(() => {});
    setUiIdle();
  }

  function evaluateTranscript(transcript) {
    stopListen = null;
    stopping = false;
    listening = false;
    checkBtn.hidden = true;
    if (!transcript?.trim()) {
      setUiIdle();
      status.textContent = 'Речь не распознана — произнесите перевод вслух и нажмите «Проверить»';
      heard.hidden = true;
      return;
    }
    listens++;
    const firstTry = listens === 1;
    const expected = getExpectedAnswer(card, promptSide);
    const { ok } = checkCardAnswer(transcript, card, promptSide, answerOpts);
    if (ok) {
      answered = true;
      hideVoiceActions();
      status.textContent = '';
      playFeedback(true);
      haptic(12);
      flashStudyCard(prompt, true);
      showStudyFeedback(heard, true, 'Верно!');
      setTimeout(() => onSuccess({ firstTry }), 580);
    } else {
      setUiIdle();
      status.textContent = '';
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

  async function finishListen() {
    if (!listening || answered || stopping) return;
    stopping = true;
    checkBtn.textContent = '…';
    status.textContent = 'Проверяю…';
    const fn = stopListen;
    stopListen = null;
    try {
      if (fn) {
        await Promise.race([
          fn({ cancel: false }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
      }
    } catch (e) {
      stopping = false;
      listening = false;
      setUiIdle();
      status.textContent = 'Не удалось проверить — нажмите «Сказать ответ» ещё раз';
    }
  }

  function startListen() {
    if (answered || listening || !speechRecognitionSupported()) return;
    autoCheckTriggered = false;
    const settings = getSettings?.();

    stopAllSpeech();
    stopAnswerAudio();

    const prev = stopListen;
    stopListen = null;
    if (prev) releaseSpeechSession(prev);

    if (!actions.contains(startBtn)) {
      actions.innerHTML = '';
      actions.append(startBtn, checkBtn);
    }

    const expected = getExpectedAnswer(card, promptSide);
    const { lang, hint } = resolveVoiceSpeechLang(expected);
    status.textContent = `${hint}…`;
    heard.hidden = true;
    setUiListening();
    if (settings) unlockAnswerAudio(settings);

    stopListen = listenOnce({
      lang,
      manualStop: true,
      contextualStrings: expectedVariants(expected),
      onInterim: (text) => {
        if (!stopping) status.textContent = `Слушаю: «${text}»`;
        maybeAutoCheck(text);
      },
      onResult: evaluateTranscript,
      onError: (err) => {
        stopListen = null;
        setUiIdle();
        status.textContent = err.message;
      },
      onEnd: () => {
        stopping = false;
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
  actions.classList.add('is-action-hidden');

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
    if (!document.body.contains(box)) return;
    box.focus({ preventScroll: true });
    requestAnimationFrame(() => showVoiceActions());
  });

  if (!speechRecognitionSupported()) {
    status.textContent = 'Голосовой режим недоступен — используйте ввод текста';
  }

  return {
    box,
    getPromptSide: () => promptSide,
    destroy() {
      document.removeEventListener('keydown', onKey, true);
      const fn = stopListen;
      stopListen = null;
      if (fn) releaseSpeechSession(fn);
    },
  };
}
