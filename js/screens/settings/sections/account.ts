import { el, toast, confirmDialog } from '../../../ui/ui.js';
import { nav } from '../../../ui/navigation.js';
import { t } from '../../../lib/i18n.js';
import type { AppStore } from '../../../core/state.js';

interface SbLike {
  getSession(): import('../../../data/supabase.js').AuthSession | null;
  signOut(): Promise<unknown>;
}

export function buildAccountGroup(
  store: AppStore,
  sb: SbLike | null,
  setStore: (s: AppStore | null) => void,
  renderAuth: () => void,
  route: () => void | Promise<void>,
) {
  const isCloud = store.kind === 'cloud';
  const accGroup = el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.account.title')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, isCloud
          ? t('settings.account.cloudLabel', { email: String(sb?.getSession()?.user?.email ?? '') })
          : t('settings.account.demoMode')),
        el('span', null, isCloud
          ? (store.offline ? t('settings.account.cloudOffline') : t('settings.account.cloudOnline'))
          : t('settings.account.demoHint')),
      ]),
      el('button', {
        class: 'btn ghost',
        onclick: async () => {
          const yes = await confirmDialog(
            isCloud ? t('settings.account.signOutCloudTitle') : t('settings.account.signOutDemoTitle'),
            isCloud ? t('settings.account.signOutCloudText') : t('settings.account.signOutDemoText'),
            t('settings.account.signOut'),
          );
          if (!yes) return;
          if (isCloud) {
            const { setActivityCloudSync } = await import('../../../lib/activity.js');
            setActivityCloudSync(null);
            await sb?.signOut();
          }
          localStorage.removeItem('kar_mode');
          setStore(null);
          nav('#home');
          renderAuth();
        },
      }, t('settings.account.signOut')),
    ]),
  ]);

  if (isCloud) {
    accGroup.append(el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.account.sync')),
        el('span', null, t('settings.account.syncHint')),
      ]),
      el('button', {
        class: 'btn',
        onclick: async () => {
          try {
            const cloudish = store as unknown as { syncActivityNow?: () => Promise<unknown> };
            if (typeof cloudish.syncActivityNow === 'function') {
              await cloudish.syncActivityNow();
            }
            const r = await store.flushSync();
            toast(r.ok ? t('shell.sync.doneOk', { ok: r.ok }) : t('settings.account.syncStatsUpdated'), 'ok');
            await route();
          } catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); }
        },
      }, t('settings.account.syncBtn')),
    ]));
  }

  return accGroup;
}
