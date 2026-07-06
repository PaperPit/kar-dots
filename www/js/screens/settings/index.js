import { store, sb, setStore } from '../../core/state.js';
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
import { buildStatsGroup } from './sections/stats.js';
import { APP_VERSION } from '../../core/version.js';

export async function renderSettings() {
  await initActivity();
  const s = store.settings;

  async function save() {
    if (s.tts === false) s.ttsAuto = false;
    try { await store.saveSettings(s); }
    catch (e) { toast('Не сохранилось: ' + e.message, 'error'); }
  }

  const statsGroup = await buildStatsGroup(store);
  const calendarGroup = buildCalendarGroup(s, save);
  const algoGroup = buildAlgoGroup(s, save);
  const soundGroup = buildSoundGroup(s, save);
  const packsGroup = buildPacksGroup();
  const dataGroup = buildDataGroup(store, route);
  const accGroup = await buildAccountGroup(store, sb, setStore, renderAuth, route);

  shell('settings', el('div', null, [
    offlineBanner(),
    el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Настройки')),
    statsGroup, calendarGroup, algoGroup, soundGroup, packsGroup, dataGroup, accGroup,
    el('p', { class: 'muted settings-footer' }, `КАР-точки · ${APP_VERSION}`),
  ]));
}
