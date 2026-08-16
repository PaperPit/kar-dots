// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../js/lib/speech-input.js', () => ({
  speechRecognitionSupported: () => true,
  listenOnce: vi.fn(),
  resolveVoiceSpeechLang: () => ({ lang: 'ru-RU', hint: 'RU' }),
  releaseSpeechSession: vi.fn(),
}));

import { createVoiceModeCard } from '../js/screens/review/modes/voice.js';

const CARD = { front: 'climb', back: 'лазать', description: '' };

describe('voice mode reveal translation + skip', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reveals translation then skips as wrong answer', () => {
    const onFail = vi.fn();
    const onSuccess = vi.fn();
    const widget = createVoiceModeCard(CARD, {
      promptSide: 'front',
      onSuccess,
      onFail,
      getSettings: () => null,
    });
    document.body.append(widget.box);

    const startBtn = widget.box.querySelector('.study-mic-btn');
    const revealBtn = widget.box.querySelector('.study-voice-reveal-translation-btn');
    expect(startBtn?.textContent).toMatch(/Сказать ответ|Say answer/i);
    expect(revealBtn).toBeTruthy();

    revealBtn.click();
    expect(widget.box.querySelector('.study-voice-reveal-translation-btn')?.hidden).toBe(true);
    expect(widget.box.querySelector('.study-feedback')?.hidden).toBe(false);
    expect(widget.box.querySelector('.study-feedback')?.textContent).toMatch(/лазать/i);

    const skipBtn = widget.box.querySelector('.study-skip-btn');
    expect(skipBtn?.textContent).toMatch(/Пропустить|Skip/i);

    skipBtn.click();
    expect(onFail).toHaveBeenCalledWith({ firstTry: false });
    expect(onSuccess).not.toHaveBeenCalled();

    widget.destroy();
  });
});
