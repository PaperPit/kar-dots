// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../js/ui/helpers.ts';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs once after the pause, with the last arguments', () => {
    const spy = vi.fn();
    const d = debounce(spy, 200);
    d('a');
    d('ab');
    d('abc');
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(199);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('abc');
  });

  it('restarts the timer on every call', () => {
    const spy = vi.fn();
    const d = debounce(spy, 100);
    d('1');
    vi.advanceTimersByTime(90);
    d('2');
    vi.advanceTimersByTime(90);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('2');
  });

  it('allows a second run after the first one fired', () => {
    const spy = vi.fn();
    const d = debounce(spy, 50);
    d('one');
    vi.advanceTimersByTime(50);
    d('two');
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('two');
  });
});

describe('folder search wiring', () => {
  it('input events are debounced, Enter is immediate', async () => {
    // Повторяем схему из screens/folder/index.ts: input → debounce, Enter →
    // немедленная перерисовка. Проверяем именно связку, а не сам обработчик.
    vi.useFakeTimers();
    const paint = vi.fn();
    const debouncedPaint = debounce(() => paint(), 200);
    const input = document.createElement('input');
    input.addEventListener('input', debouncedPaint);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') paint();
    });

    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('input'));
    expect(paint).not.toHaveBeenCalled();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(paint).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(200);
    expect(paint).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
