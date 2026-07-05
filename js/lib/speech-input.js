export function speechRecognitionSupported() {
  return !!(typeof window !== 'undefined'
    && (window.SpeechRecognition || window.webkitSpeechRecognition));
}

/**
 * Одноразовое распознавание речи. Возвращает функцию stop().
 */
export function listenOnce({ lang, onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onError?.(new Error('Распознавание речи недоступно в этом браузере'));
    return () => {};
  }
  const rec = new SR();
  rec.lang = lang || 'ru-RU';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  let stopped = false;
  rec.onresult = (e) => {
    const t = e.results?.[0]?.[0]?.transcript?.trim() || '';
    onResult?.(t);
  };
  rec.onerror = (e) => {
    if (stopped) return;
    if (e.error === 'aborted') return;
    const msg = e.error === 'not-allowed'
      ? 'Нет доступа к микрофону'
      : (e.error === 'no-speech' ? 'Речь не распознана' : (e.error || 'Ошибка распознавания'));
    onError?.(new Error(msg));
  };
  rec.onend = () => { if (!stopped) onEnd?.(); };

  try {
    rec.start();
  } catch (e) {
    onError?.(e);
    return () => {};
  }

  return () => {
    stopped = true;
    try { rec.stop(); } catch (e) {}
  };
}
