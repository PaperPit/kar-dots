import { el } from '../../../ui/ui.js';
import { segControl } from '../shared.js';
import { t, applyUiLocale, localeTag, type AppLocale } from '../../../lib/i18n.js';
import { route } from '../../../core/router.js';
import { invalidateShell } from '../../../ui/shell.js';
import type { Settings } from '../../../data/types.js';

export function buildLanguageGroup(s: Settings, save: () => void | Promise<void>) {
  const current = (s.language === 'en' ? 'en' : 'ru') as AppLocale;

  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.language.title')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.language.label')),
        el('span', null, t('settings.language.hint')),
      ]),
      segControl(current, [
        { v: 'ru', label: t('settings.language.ru') },
        { v: 'en', label: t('settings.language.en') },
      ], async (v) => {
        const lang = (v === 'en' ? 'en' : 'ru') as AppLocale;
        s.language = lang;
        applyUiLocale(lang);
        s.dateLocale = localeTag();
        invalidateShell();
        await save();
        await route();
      }),
    ]),
  ]);
}
