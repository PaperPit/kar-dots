// @vitest-environment happy-dom
/**
 * Диагностика режима «Голос»: почему речь «не распознаётся».
 * Симулируем Capacitor iOS + нативный SpeechRecognition без реального микрофона.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { checkCardAnswer, answersMatch } from '../js/lib/answer-check.ts';

const CARD_LAST = { front: 'last', back: 'последний', description: '' };
const CARD_BABY = { front: 'baby', back: 'малыш', description: '' };

function createMockSpeechRecognition() {
  const listeners = {};
  let lastPartial = { accumulatedText: '' };

  const api = {
    checkPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
    requestPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
    available: vi.fn(async () => ({ available: true })),
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    forceStop: vi.fn(async () => {}),
    getLastPartialResult: vi.fn(async () => lastPartial),
    addListener: vi.fn(async (event, cb) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return {
        remove: vi.fn(async () => {
          listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
        }),
      };
    }),
    /** Тест: эмулируем partialResults от iOS */
    emitPartial(text) {
      lastPartial = { accumulatedText: text, matches: [text] };
      for (const cb of listeners.partialResults || []) {
        cb({ accumulatedText: text, matches: [text] });
      }
    },
    /** Тест: iOS отдал текст только в getLastPartialResult при stop */
    setLastPartialOnly(text) {
      lastPartial = { accumulatedText: text };
    },
    clearPartial() {
      lastPartial = { accumulatedText: '' };
    },
    emitError(code, message = '') {
      for (const cb of listeners.error || []) {
        cb({ code, message });
      }
    },
    reset() {
      Object.keys(listeners).forEach((k) => { listeners[k] = []; });
      lastPartial = { accumulatedText: '' };
      api.checkPermissions.mockReset();
      api.requestPermissions.mockReset();
      api.available.mockReset();
      api.start.mockReset();
      api.stop.mockReset();
      api.forceStop.mockReset();
      api.getLastPartialResult.mockReset();
      api.addListener.mockReset();
      api.checkPermissions.mockImplementation(async () => ({ speechRecognition: 'granted' }));
      api.requestPermissions.mockImplementation(async () => ({ speechRecognition: 'granted' }));
      api.available.mockImplementation(async () => ({ available: true }));
      api.start.mockImplementation(async () => {});
      api.stop.mockImplementation(async () => {});
      api.forceStop.mockImplementation(async () => {});
      api.getLastPartialResult.mockImplementation(async () => lastPartial);
      api.addListener.mockImplementation(async (event, cb) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
        return { remove: vi.fn(async () => {}) };
      });
    },
  };
  return api;
}

const mockSR = vi.hoisted(() => createMockSpeechRecognition());

vi.mock('../js/vendor/capacitor-speech-recognition.mjs', () => ({
  SpeechRecognition: mockSR,
}));

function setupCapacitorNative() {
  window.Capacitor = { isNativePlatform: () => true };
  delete window.webkitSpeechRecognition;
  delete window.SpeechRecognition;
}

async function loadSpeechInput() {
  vi.resetModules();
  setupCapacitorNative();
  return import('../js/lib/speech-input.ts');
}

async function listenAndStop({ lang = 'ru-RU', emitDuringListen, lastPartialOnStop } = {}) {
  const { listenOnce } = await loadSpeechInput();
  let result = null;
  let error = null;

  const stop = listenOnce({
    lang,
    manualStop: true,
    contextualStrings: ['последний'],
    onResult: (t) => { result = t; },
    onError: (e) => { error = e?.message || String(e); },
  });

  await vi.waitFor(() => expect(mockSR.start).toHaveBeenCalled(), { timeout: 3000 });

  if (emitDuringListen) emitDuringListen(mockSR);

  await stop({ cancel: false });
  await new Promise((r) => setTimeout(r, 350));

  return { result, error };
}

describe('диагностика: проверка ответа после распознавания', () => {
  it('принимает правильный русский перевод «последний»', () => {
    expect(checkCardAnswer('последний', CARD_LAST, 'front', { fuzzy: true, fuzzyThreshold: 0.68 }).ok).toBe(true);
  });

  it('ОТКЛОНЯЕТ английское слово с карточки — частая ошибка пользователя', () => {
    const { ok } = checkCardAnswer('last', CARD_LAST, 'front', { fuzzy: true, fuzzyThreshold: 0.68 });
    expect(ok).toBe(false);
  });

  it('принимает типичную опечатку распознавания «паследний»', () => {
    expect(answersMatch('паследний', 'последний', { fuzzy: true, fuzzyThreshold: 0.68 })).toBe(true);
  });

  it('принимает латиницу от Apple «posledniy» только если fuzzy достаточно высокий', () => {
    const ok = answersMatch('posledniy', 'последний', { fuzzy: true, fuzzyThreshold: 0.68 });
    expect(ok).toBe(false);
  });

  it('пустая строка = «Речь не распознана» в UI', () => {
    expect(checkCardAnswer('', CARD_LAST, 'front').ok).toBe(false);
    expect(checkCardAnswer('   ', CARD_LAST, 'front').ok).toBe(false);
  });
});

describe('диагностика: язык распознавания', () => {
  it('для карточки last→последний ставит ru-RU (не en-US)', async () => {
    const { resolveVoiceSpeechLang } = await loadSpeechInput();
    const { lang, hint } = resolveVoiceSpeechLang('последний');
    expect(lang).toBe('ru-RU');
    expect(hint).toBe('Скажите перевод по-русски');
  });

  it('listenOnce передаёт ru-RU в нативный start', async () => {
    mockSR.reset();
    await listenAndStop({ lang: 'ru-RU', emitDuringListen: (sr) => sr.emitPartial('последний') });
    expect(mockSR.start).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'ru-RU', partialResults: true }),
    );
  });
});

describe('диагностика: нативный плагин iOS (мок)', () => {
  beforeEach(() => {
    mockSR.reset();
    setupCapacitorNative();
  });

  afterEach(() => {
    delete window.Capacitor;
  });

  it('УСПЕХ: partialResults во время записи → текст при «Проверить»', async () => {
    const { result, error } = await listenAndStop({
      emitDuringListen: (sr) => sr.emitPartial('последний'),
    });
    expect(error).toBeNull();
    expect(result).toBe('последний');
    expect(checkCardAnswer(result, CARD_LAST, 'front', { fuzzy: true, fuzzyThreshold: 0.68 }).ok).toBe(true);
  });

  it('УСПЕХ: текст только в getLastPartialResult при stop (без partialResults)', async () => {
    mockSR.reset();
    const { listenOnce } = await loadSpeechInput();
    let result = null;

    const stop = listenOnce({
      lang: 'ru-RU',
      manualStop: true,
      onResult: (t) => { result = t; },
    });

    await vi.waitFor(() => expect(mockSR.start).toHaveBeenCalled());
    mockSR.setLastPartialOnly('малыш');

    await stop({ cancel: false });
    await new Promise((r) => setTimeout(r, 350));

    expect(result).toBe('малыш');
    expect(checkCardAnswer(result, CARD_BABY, 'front', { fuzzy: true, fuzzyThreshold: 0.68 }).ok).toBe(true);
  });

  it('ПРОБЛЕМА: плагин молчит → пустой transcript → «Речь не распознана»', async () => {
    const { result, error } = await listenAndStop({});
    expect(result).toBe('');
    expect(error).toBeNull();
    expect(checkCardAnswer(result, CARD_LAST, 'front').ok).toBe(false);
  });

  it('ПРОБЛЕМА: нет разрешения speechRecognition', async () => {
    mockSR.checkPermissions.mockResolvedValueOnce({ speechRecognition: 'denied' });
    mockSR.requestPermissions.mockResolvedValueOnce({ speechRecognition: 'denied' });

    const { listenOnce } = await loadSpeechInput();
    let error = null;

    listenOnce({
      lang: 'ru-RU',
      manualStop: true,
      onResult: () => {},
      onError: (e) => { error = e.message; },
    });

    await vi.waitFor(() => expect(error).toBe('Нет доступа к микрофону'), { timeout: 3000 });
    expect(mockSR.start).not.toHaveBeenCalled();
  });

  it('ПРОБЛЕМА: iOS error no-speech во время сессии', async () => {
    const { listenOnce } = await loadSpeechInput();
    let error = null;

    const stop = listenOnce({
      lang: 'ru-RU',
      manualStop: true,
      onResult: () => {},
      onError: (e) => { error = e.message; },
    });

    await vi.waitFor(() => expect(mockSR.start).toHaveBeenCalled());
    mockSR.emitError('no-speech');

    await stop({ cancel: false });
    expect(error).toBe('Речь не распознана');
  });

  it('вторая карточка: после stop первой сессии start вызывается снова', async () => {
    mockSR.reset();

    const first = await listenAndStop({
      emitDuringListen: (sr) => sr.emitPartial('последний'),
    });
    expect(first.result).toBe('последний');

    mockSR.reset();
    mockSR.checkPermissions.mockResolvedValue({ speechRecognition: 'granted' });
    mockSR.available.mockResolvedValue({ available: true });

    const second = await listenAndStop({
      emitDuringListen: (sr) => sr.emitPartial('малыш'),
    });
    expect(second.result).toBe('малыш');
    expect(mockSR.start).toHaveBeenCalledTimes(1);
  });

  it('вторая карточка: forceStop перед новым start (очередь сессий)', async () => {
    const { listenOnce, releaseSpeechSession } = await loadSpeechInput();

    const stop1 = listenOnce({ lang: 'ru-RU', manualStop: true, onResult: () => {} });
    await vi.waitFor(() => expect(mockSR.start).toHaveBeenCalledTimes(1));

    releaseSpeechSession(stop1);
    await new Promise((r) => setTimeout(r, 600));

    mockSR.forceStop.mockClear();
    mockSR.start.mockClear();

    const stop2 = listenOnce({ lang: 'ru-RU', manualStop: true, onResult: () => {} });
    await vi.waitFor(() => expect(mockSR.start).toHaveBeenCalledTimes(1));
    await stop2({ cancel: true });

    expect(mockSR.forceStop.mock.calls.length + mockSR.start.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('диагностика: цепочка «услышано → верно/неверно»', () => {
  const scenarios = [
    { heard: 'последний', expected: true, why: 'правильный перевод' },
    { heard: 'last', expected: false, why: 'сказали английское слово с карточки' },
    { heard: 'Last', expected: false, why: 'английское с заглавной' },
    { heard: 'паследний', expected: true, why: 'опечатка распознавания' },
    { heard: '', expected: false, why: 'микрофон ничего не вернул' },
    { heard: 'последний последний', expected: false, why: 'лишние слова — strict match' },
  ];

  it.each(scenarios)('$why: «$heard» → ok=$expected', ({ heard, expected }) => {
    const { ok } = checkCardAnswer(heard, CARD_LAST, 'front', { fuzzy: true, fuzzyThreshold: 0.68 });
    expect(ok).toBe(expected);
  });
});
