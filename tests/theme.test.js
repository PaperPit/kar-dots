import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveTheme } from '../js/lib/theme.js';

describe('resolveTheme', () => {
  let matchMedia;

  beforeEach(() => {
    matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('window', { matchMedia });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns stored light/dark as-is', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('falls back to system preference', () => {
    matchMedia.mockReturnValue({ matches: true });
    expect(resolveTheme(null)).toBe('dark');
    matchMedia.mockReturnValue({ matches: false });
    expect(resolveTheme('auto')).toBe('light');
  });
});
