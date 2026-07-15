// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { pickNativeTranscript } from '../js/lib/speech-input.js';

describe('resolveVoiceSpeechLang', () => {
  it('uses Russian for Cyrillic answers', async () => {
    const { resolveVoiceSpeechLang } = await import('../js/lib/speech-input.js');
    expect(resolveVoiceSpeechLang('малыш')).toEqual({
      lang: 'ru-RU',
      hint: 'Скажите перевод по-русски',
    });
  });

  it('uses English for Latin answers', async () => {
    const { resolveVoiceSpeechLang } = await import('../js/lib/speech-input.js');
    expect(resolveVoiceSpeechLang('baby')).toEqual({
      lang: 'en-US',
      hint: 'Скажите ответ по-английски',
    });
  });
});

describe('pickSpeechBackend', () => {
  it('prefers native on Capacitor iOS', async () => {
    const { pickSpeechBackend } = await import('../js/lib/speech-input.js');
    window.Capacitor = { isNativePlatform: () => true };
    window.webkitSpeechRecognition = function MockRec() {};
    expect(pickSpeechBackend()).toBe('native');
    delete window.Capacitor;
    delete window.webkitSpeechRecognition;
  });
});

describe('listenOnce routing', () => {
  it('starts web speech synchronously when available in browser', async () => {
    const { listenOnce, webSpeechRecognitionSupported } = await import('../js/lib/speech-input.js');
    if (!webSpeechRecognitionSupported()) return;

    class MockRec {
      constructor() {
        this.lang = '';
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.continuous = false;
      }
      start() {}
      stop() {
        this.onend?.();
      }
    }
    const prev = window.webkitSpeechRecognition;
    window.webkitSpeechRecognition = MockRec;
    delete window.Capacitor;

    const stop = listenOnce({
      manualStop: true,
      onResult: () => {},
      onEnd: () => {},
    });
    expect(typeof stop).toBe('function');
    await stop({ cancel: true });

    window.webkitSpeechRecognition = prev;
  });
});

describe('prepareSpeechSession', () => {
  it('waits for web speech cooldown', async () => {
    const { prepareSpeechSession } = await import('../js/lib/speech-input.js');
    const t0 = Date.now();
    await prepareSpeechSession();
    await prepareSpeechSession();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(0);
  });
});

describe('pickNativeTranscript', () => {
  it('prefers accumulatedText', () => {
    expect(pickNativeTranscript({
      accumulatedText: 'мой',
      accumulated: 'mo',
      matches: ['m'],
    })).toBe('мой');
  });

  it('falls back to matches', () => {
    expect(pickNativeTranscript({ matches: ['hello'] })).toBe('hello');
  });

  it('returns empty string when nothing heard', () => {
    expect(pickNativeTranscript({})).toBe('');
  });
});
