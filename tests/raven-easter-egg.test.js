import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncRavenEggScreen, tryRavenEggClick } from '../js/lib/raven-easter-egg.js';

describe('raven-easter-egg', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    syncRavenEggScreen('other');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('срабатывает на 10-м клике на главной', () => {
    syncRavenEggScreen('home');
    for (let i = 0; i < 9; i++) expect(tryRavenEggClick()).toBe(false);
    expect(tryRavenEggClick()).toBe(true);
  });

  it('сбрасывает счётчик при уходе с главной', () => {
    syncRavenEggScreen('home');
    for (let i = 0; i < 5; i++) tryRavenEggClick();
    syncRavenEggScreen('settings');
    syncRavenEggScreen('home');
    for (let i = 0; i < 9; i++) expect(tryRavenEggClick()).toBe(false);
    expect(tryRavenEggClick()).toBe(true);
  });

  it('сбрасывает счётчик по таймауту', () => {
    syncRavenEggScreen('home');
    for (let i = 0; i < 5; i++) tryRavenEggClick();
    vi.advanceTimersByTime(5000);
    for (let i = 0; i < 9; i++) expect(tryRavenEggClick()).toBe(false);
    expect(tryRavenEggClick()).toBe(true);
  });
});
