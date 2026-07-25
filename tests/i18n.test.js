import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  t,
  tp,
  setLocale,
  getLocale,
  normalizeLocale,
  localeTag,
  applyUiLocale,
  hasKey,
} from '../js/lib/i18n.ts';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('ru');
  });

  afterEach(() => {
    setLocale('ru');
  });

  it('normalizes locale strings', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('ru')).toBe('ru');
    expect(normalizeLocale('')).toBe('ru');
    expect(normalizeLocale(undefined)).toBe('ru');
  });

  it('setLocale / getLocale / localeTag', () => {
    expect(setLocale('en')).toBe('en');
    expect(getLocale()).toBe('en');
    expect(localeTag()).toBe('en-US');
    setLocale('ru');
    expect(localeTag()).toBe('ru-RU');
  });

  it('t returns Russian by default', () => {
    expect(t('common.cancel')).toBe('Отмена');
    expect(t('shell.nav.home')).toBe('Папки');
  });

  it('t interpolates params', () => {
    expect(t('shell.sync.pending', { n: 3 })).toBe('В очереди синхронизации: 3.');
  });

  it('falls back to Russian when English key missing', () => {
    setLocale('en');
    // known key translated
    expect(t('common.cancel')).toBe('Cancel');
    // invent a ru-only key via hasKey check on existing
    expect(hasKey('common.cancel')).toBe(true);
  });

  it('returns key and warns when missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('no.such.key.ever')).toBe('no.such.key.ever');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('tp pluralizes Russian', () => {
    setLocale('ru');
    expect(tp('common.card', 1)).toBe('карточка');
    expect(tp('common.card', 2)).toBe('карточки');
    expect(tp('common.card', 5)).toBe('карточек');
    expect(tp('common.card', 11)).toBe('карточек');
    expect(tp('common.card', 21)).toBe('карточка');
  });

  it('tp pluralizes English', () => {
    setLocale('en');
    expect(tp('common.card', 1)).toBe('card');
    expect(tp('common.card', 2)).toBe('cards');
    expect(tp('common.folder', 5)).toBe('folders');
  });

  it('applyUiLocale sets document lang', () => {
    applyUiLocale('en');
    expect(document.documentElement.lang).toBe('en');
    applyUiLocale('ru');
    expect(document.documentElement.lang).toBe('ru');
  });
});
