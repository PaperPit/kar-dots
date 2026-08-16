import { store, sb, setStore } from '../../core/state.js';
import { APP_GITHUB_URL, APP_VERSION_SHORT } from '../../core/version.js';
import { el, toast } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { renderAuth } from '../auth/index.js';
import { route } from '../../core/router.js';
import { initActivity } from '../../lib/activity.js';
import { t } from '../../lib/i18n.js';
import { isAppInstalled, promptInstall } from '../../app.js';
import { buildLanguageGroup } from './sections/language.js';
import { buildCalendarGroup } from './sections/calendar.js';
import { buildAlgoGroup } from './sections/algo.js';
import { buildSoundGroup } from './sections/sounds.js';
import { buildPacksGroup } from './sections/packs.js';
import { buildDataGroup } from './sections/data.js';
import { buildAccountGroup } from './sections/account.js';
import { buildSyncGroup } from './sections/sync.js';
import { buildIntegrationsGroup } from './sections/integrations.js';
import { buildStockMediaGroup } from './sections/stock-media.js';
import { buildDonateGroup } from './sections/donate.js';

function buildAboutGroup() {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.about.title')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.about.github')),
        el('span', null, t('settings.about.githubHint')),
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          window.open(APP_GITHUB_URL, '_blank', 'noopener,noreferrer');
        },
      }, t('common.open')),
    ]),
  ]);
}

export async function renderSettings() {
  await initActivity();
  const s = store.settings;

  async function save() {
    if (s.tts === false) s.ttsAuto = false;
    try { await store.saveSettings(s); }
    catch (e) {
      toast(t('settings.saveFailed', { message: e instanceof Error ? e.message : String(e) }), 'error');
    }
  }

  const languageGroup = buildLanguageGroup(s, save);
  const calendarGroup = buildCalendarGroup(s, save);
  const algoGroup = buildAlgoGroup(s, save);
  const soundGroup = buildSoundGroup(s, save);
  const packsGroup = buildPacksGroup();
  const integrationsGroup = buildIntegrationsGroup(s, save);
  const stockMediaGroup = buildStockMediaGroup(s, save);
  const dataGroup = buildDataGroup(store, route);
  const syncGroup = buildSyncGroup(store, route);
  const accGroup = buildAccountGroup(store, sb, setStore, renderAuth, route);
  const aboutGroup = buildAboutGroup();
  const donateGroup = buildDonateGroup();

  const installBtn = !isAppInstalled()
    ? el('button', {
        class: 'btn accent',
        type: 'button',
        onclick: async () => {
          const ok = await promptInstall();
          if (ok) toast(t('settings.install.installed'), 'ok');
        },
      }, t('settings.install.button'))
    : null;

  shell('settings', el('div', null, [
    offlineBanner(),
    el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, t('settings.title'))),
    languageGroup, calendarGroup, algoGroup, soundGroup, packsGroup, integrationsGroup, stockMediaGroup, dataGroup, syncGroup, accGroup,
    donateGroup,
    installBtn ? el('div', { class: 'settings-group' }, [
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, t('settings.install.title')),
          el('span', null, t('settings.install.lead')),
        ]),
        installBtn,
      ]),
    ]) : null,
    aboutGroup,
    el('p', { class: 'muted settings-footer' }, t('settings.footer', { version: APP_VERSION_SHORT })),
  ]));
}
