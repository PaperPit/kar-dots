// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createTypeModeCard } from '../js/screens/review/modes/type.js';

const CARD = { front: 'climb', back: 'лазать', description: '' };

function waitForFocus() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

describe('type mode input focus and empty guard', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses input on mount and blocks empty check', async () => {
    const onFail = vi.fn();
    const onSuccess = vi.fn();
    const widget = createTypeModeCard(CARD, {
      promptSide: 'front',
      onSuccess,
      onFail,
      getSettings: () => null,
    });
    document.body.append(widget.box);

    const input = widget.box.querySelector('.study-answer-input');
    const checkBtn = widget.box.querySelector('.study-check-btn');

    await waitForFocus();
    expect(document.activeElement).toBe(input);
    expect(checkBtn.disabled).toBe(true);

    checkBtn.click();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();

    input.value = 'лазать';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(checkBtn.disabled).toBe(false);

    checkBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(onSuccess).toHaveBeenCalledWith({ firstTry: true });
    expect(onFail).not.toHaveBeenCalled();

    widget.destroy();
  });

  it('ignores Enter on empty input', async () => {
    const onSuccess = vi.fn();
    const widget = createTypeModeCard(CARD, {
      promptSide: 'front',
      onSuccess,
      onFail: vi.fn(),
      getSettings: () => null,
    });
    document.body.append(widget.box);

    const input = widget.box.querySelector('.study-answer-input');
    await waitForFocus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSuccess).not.toHaveBeenCalled();

    widget.destroy();
  });

  it('replaces hint with wrong feedback above the input', async () => {
    const widget = createTypeModeCard(CARD, {
      promptSide: 'front',
      onSuccess: vi.fn(),
      onFail: vi.fn(),
      getSettings: () => null,
    });
    document.body.append(widget.box);

    const hint = widget.box.querySelector('.study-hint');
    const feedback = widget.box.querySelector('.study-feedback');
    const input = widget.box.querySelector('.study-answer-input');
    const checkBtn = widget.box.querySelector('.study-check-btn');
    const statusSlot = widget.box.querySelector('.study-status-slot');

    expect(hint?.hidden).toBe(false);
    expect(feedback?.hidden).toBe(true);
    expect(statusSlot?.contains(hint)).toBe(true);
    expect(statusSlot?.contains(feedback)).toBe(true);
    expect(input.compareDocumentPosition(statusSlot) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    input.value = 'нет';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    checkBtn.click();

    expect(hint?.hidden).toBe(true);
    expect(feedback?.hidden).toBe(false);
    expect(feedback?.textContent).toMatch(/Неверно|Wrong|Incorrect/i);

    input.value = 'ла';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(hint?.hidden).toBe(false);
    expect(feedback?.hidden).toBe(true);

    widget.destroy();
  });

  it('dont-know reveals answer, locks input, then next fails', () => {
    const onFail = vi.fn();
    const widget = createTypeModeCard(CARD, {
      promptSide: 'front',
      onSuccess: vi.fn(),
      onFail,
      getSettings: () => null,
    });
    document.body.append(widget.box);

    const input = widget.box.querySelector('.study-answer-input');
    const dontKnow = widget.box.querySelector('.study-dont-know-btn');
    expect(dontKnow).toBeTruthy();

    dontKnow.click();

    expect(input.hidden).toBe(true);
    expect(input.disabled).toBe(true);
    expect(widget.box.querySelector('.study-feedback')?.textContent).toMatch(/лазать/i);
    expect(widget.box.querySelector('.study-next-btn')?.textContent).toMatch(/Далее|Next/i);
    expect(onFail).not.toHaveBeenCalled();

    widget.box.querySelector('.study-next-btn').click();
    expect(onFail).toHaveBeenCalledWith({ firstTry: false });

    widget.destroy();
  });
});
