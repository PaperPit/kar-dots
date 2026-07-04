import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateText, getTranslateDir, setTranslateDir, translateDirLabel, flipTranslateDir } from '../js/lib/translate.js';

const ls = {};
beforeEach(() => {
  Object.keys(ls).forEach(k => delete ls[k]);
  vi.stubGlobal('localStorage', {
    getItem: k => (k in ls ? ls[k] : null),
    setItem: (k, v) => { ls[k] = v; },
    removeItem: k => { delete ls[k]; },
  });
});

describe('translateText', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'hello' },
      }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('запрашивает MyMemory с ru|en', async () => {
    const out = await translateText('привет', 'ru-en');
    expect(out).toBe('hello');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('langpair=ru|en'));
  });

  it('бросает ошибку на пустой текст', async () => {
    await expect(translateText('  ')).rejects.toThrow('Нечего переводить');
  });
});

describe('translate dir storage', () => {
  it('сохраняет направление в localStorage', () => {
    setTranslateDir('en-ru');
    expect(getTranslateDir()).toBe('en-ru');
    setTranslateDir('ru-en');
    expect(getTranslateDir()).toBe('ru-en');
  });

  it('переключает направление и показывает подпись', () => {
    expect(translateDirLabel('ru-en')).toBe('RU → EN');
    expect(translateDirLabel('en-ru')).toBe('EN → RU');
    expect(flipTranslateDir('ru-en')).toBe('en-ru');
    expect(flipTranslateDir('en-ru')).toBe('ru-en');
  });
});
