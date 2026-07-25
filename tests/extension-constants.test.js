import { describe, it, expect } from 'vitest';
import { APP_ORIGIN, CONNECT_URL, DEFAULT_PREFS, MODES, STORAGE_KEYS } from '../extension/src/lib/constants';

describe('extension constants', () => {
  it('APP_ORIGIN — единственный прод-origin', () => {
    expect(APP_ORIGIN).toBe('https://kar-tochki.pages.dev');
    expect(CONNECT_URL).toContain('ext_connect=1');
    expect(CONNECT_URL.startsWith(APP_ORIGIN)).toBe(true);
  });

  it('DEFAULT_PREFS и MODES согласованы', () => {
    expect(DEFAULT_PREFS.mode).toBe('both');
    expect(MODES.map((m) => m.id)).toContain(DEFAULT_PREFS.mode);
    expect(STORAGE_KEYS.auth).toBe('kar_ext_auth');
  });
});
