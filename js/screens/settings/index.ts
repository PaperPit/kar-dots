import { store, sb, setStore } from '../../core/state.js';
import { APP_GITHUB_URL, APP_VERSION_SHORT } from '../../core/version.js';
import { el, toast } from '../../ui/ui.js';
import { shell, offlineBanner } from '../../ui/shell.js';
import { renderAuth } from '../auth/index.js';
import { route } from '../../core/router.js';
import { initActivity } from '../../lib/activity.js';
import { buildCalendarGroup } from './sections/calendar.js';
import { buildAlgoGroup } from './sections/algo.js';
import { buildSoundGroup } from './sections/sounds.js';
import { buildPacksGroup } from './sections/packs.js';
import { buildDataGroup } from './sections/data.js';
import { buildAccountGroup } from './sections/account.js';
import { buildIntegrationsGroup } from './sections/integrations.js';
import { buildStockMediaGroup } from './sections/stock-media.js';

function buildAboutGroup() {
  return el('div', { class: 'settings-group' }, [
    el('h4', null, 'Проект'),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'GitHub'),
        el('span', null, 'Исходный код приложения на GitHub.'),
      ]),
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          window.open(APP_GITHUB_URL, '_blank', 'noopener,noreferrer');
        },
      }, 'Открыть'),
    ]),
  ]);
}

export async function renderSettings() {
  await initActivity();
  const s = store.settings;

  async function save() {
    if (s.tts === false) s.ttsAuto = false;
    try { await store.saveSettings(s); }
    catch (e) { toast('Не сохранилось: ' + (e instanceof Error ? e.message : String(e)), 'error'); }
  }

  const calendarGroup = buildCalendarGroup(s, save);
  const algoGroup = buildAlgoGroup(s, save);
  const soundGroup = buildSoundGroup(s, save);
  const packsGroup = buildPacksGroup();
  const integrationsGroup = buildIntegrationsGroup(s, save);
  const stockMediaGroup = buildStockMediaGroup(s, save);
  const dataGroup = buildDataGroup(store, route);
  const accGroup = buildAccountGroup(store, sb, setStore, renderAuth, route);
  const aboutGroup = buildAboutGroup();

  shell('settings', el('div', null, [
    offlineBanner(),
    el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Настройки')),
    calendarGroup, algoGroup, soundGroup, packsGroup, integrationsGroup, stockMediaGroup, dataGroup, accGroup,
    aboutGroup,
    el('p', { class: 'muted settings-footer' }, `КАР-точки · v${APP_VERSION_SHORT}`),
  ]));
}
