let nativePlugin = null;
let nativePluginLoading = null;

export function isNativeSpeechPlatform() {
  return typeof window !== 'undefined'
    && !!window.Capacitor?.isNativePlatform?.();
}

export function speechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  if (isNativeSpeechPlatform()) return true;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

async function loadNativePlugin() {
  if (nativePlugin) return nativePlugin;
  if (!isNativeSpeechPlatform()) return null;
  if (!nativePluginLoading) {
    nativePluginLoading = import('../vendor/capacitor-speech-recognition.mjs')
      .then((mod) => {
        nativePlugin = mod.SpeechRecognition;
        return nativePlugin;
      })
      .catch(() => null);
  }
  return nativePluginLoading;
}

export function pickNativeTranscript(event) {
  return event?.accumulatedText?.trim()
    || event?.accumulated?.trim()
    || event?.matches?.[0]?.trim()
    || '';
}

function mapNativeError(event) {
  const code = event?.code || '';
  if (code === 'not-allowed' || code === 'permission') return 'Нет доступа к микрофону';
  if (code === 'no-speech') return 'Речь не распознана';
  return event?.message || code || 'Ошибка распознавания';
}

function pickBestAlternative(result) {
  let best = '';
  let bestConf = -1;
  for (let i = 0; i < result.length; i++) {
    const alt = result[i]?.transcript?.trim();
    if (!alt) continue;
    const conf = result[i].confidence ?? (i === 0 ? 1 : 0);
    if (conf >= bestConf) {
      bestConf = conf;
      best = alt;
    }
  }
  return best;
}

async function ensureNativePermissions(SR) {
  const current = await SR.checkPermissions();
  if (current.speechRecognition === 'granted') return true;
  const requested = await SR.requestPermissions();
  return requested.speechRecognition === 'granted';
}

function listenOnceNative({
  lang,
  onResult,
  onInterim,
  onError,
  onEnd,
  manualStop = false,
  contextualStrings = [],
} = {}) {
  let stopped = false;
  let delivered = false;
  let started = false;
  let transcript = '';
  const handles = [];
  let SR = null;

  async function teardown() {
    await Promise.all(handles.splice(0).map((h) => h.remove().catch(() => {})));
    try { await SR?.removeAllListeners?.(); } catch (e) {}
  }

  function deliver() {
    if (delivered) return;
    delivered = true;
    onResult?.(transcript);
  }

  async function refreshTranscript() {
    try {
      const last = await SR?.getLastPartialResult?.();
      const text = last?.text?.trim() || pickNativeTranscript({ matches: last?.matches });
      if (text) transcript = text;
    } catch (e) {}
  }

  async function begin() {
    try {
      SR = await loadNativePlugin();
      if (!SR) throw new Error('Нативное распознавание недоступно');
      if (stopped) return;

      if (!(await ensureNativePermissions(SR))) {
        onError?.(new Error('Нет доступа к микрофону'));
        return;
      }
      if (stopped) return;

      const { available } = await SR.available();
      if (!available) {
        onError?.(new Error('Распознавание речи недоступно на этом устройстве'));
        return;
      }
      if (stopped) return;

      handles.push(await SR.addListener('partialResults', (event) => {
        const text = pickNativeTranscript(event);
        if (text) {
          transcript = text;
          onInterim?.(text);
        }
        if (manualStop && event?.forced && stopped && !delivered) {
          deliver();
        }
      }));

      handles.push(await SR.addListener('error', (event) => {
        if (stopped || delivered) return;
        onError?.(new Error(mapNativeError(event)));
      }));

      handles.push(await SR.addListener('listeningState', async (event) => {
        if (event?.state !== 'stopped' || !stopped || delivered) return;
        await refreshTranscript();
        deliver();
        await teardown();
        onEnd?.();
      }));

      const hints = contextualStrings
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .slice(0, 12);

      await SR.start({
        language: lang || 'ru-RU',
        partialResults: true,
        maxResults: 3,
        contextualStrings: hints.length ? hints : undefined,
      });
      started = true;
    } catch (e) {
      if (!stopped) onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  begin();

  return () => {
    if (stopped) return;
    stopped = true;
    (async () => {
      try {
        if (!SR) SR = await loadNativePlugin();
        if (!SR) {
          if (!delivered) onEnd?.();
          return;
        }
        if (!started) {
          onEnd?.();
          return;
        }
        if (manualStop) {
          await SR.forceStop().catch(() => SR.stop());
          await refreshTranscript();
          if (!delivered) deliver();
          await teardown();
          onEnd?.();
          return;
        }
        await SR.stop();
      } catch (e) {
        onEnd?.();
      }
    })();
  };
}

function listenOnceWeb({
  lang,
  onResult,
  onInterim,
  onError,
  onEnd,
  manualStop = false,
} = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onError?.(new Error('Распознавание речи недоступно в этом браузере'));
    return () => {};
  }
  const rec = new SR();
  rec.lang = lang || 'ru-RU';
  rec.interimResults = manualStop;
  rec.maxAlternatives = manualStop ? 3 : 1;
  rec.continuous = manualStop;

  let stopped = false;
  let delivered = false;
  const finals = [];
  let interim = '';

  function transcript() {
    return [...finals, interim].filter(Boolean).join(' ').trim();
  }

  function deliver() {
    if (delivered) return;
    delivered = true;
    onResult?.(transcript());
  }

  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = pickBestAlternative(r);
      if (!t) continue;
      if (r.isFinal) finals.push(t);
      else interim = interim ? `${interim} ${t}` : t;
    }
    const current = transcript();
    if (current) onInterim?.(current);
    if (!manualStop && finals.length) {
      stopped = true;
      deliver();
    }
  };

  rec.onerror = (e) => {
    if (stopped || delivered) return;
    if (e.error === 'aborted') return;
    const msg = e.error === 'not-allowed'
      ? 'Нет доступа к микрофону'
      : (e.error === 'no-speech' ? 'Речь не распознана' : (e.error || 'Ошибка распознавания'));
    onError?.(new Error(msg));
  };

  rec.onend = () => {
    if (manualStop) {
      if (!stopped) {
        onEnd?.();
        return;
      }
      if (!delivered) deliver();
      onEnd?.();
      return;
    }
    if (!stopped) onEnd?.();
  };

  try {
    rec.start();
  } catch (e) {
    onError?.(e);
    return () => {};
  }

  return () => {
    if (stopped) return;
    stopped = true;
    try { rec.stop(); } catch (e) {}
  };
}

/**
 * Распознавание речи. Возвращает функцию stop().
 * На iOS/Android — нативный SFSpeechRecognizer через Capgo-плагин.
 * В браузере — Web Speech API.
 */
export function listenOnce(options = {}) {
  if (isNativeSpeechPlatform()) return listenOnceNative(options);
  return listenOnceWeb(options);
}
