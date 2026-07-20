import { el, toast, confirmDialog } from '../../../ui/ui.js';
import { nav } from '../../../ui/shell.js';
import type { LocalStore } from '../../../data/store-local.js';

interface SbLike {
  getSession(): import('../../../data/supabase.js').AuthSession | null;
  signOut(): Promise<unknown>;
}

export function buildAccountGroup(
  store: LocalStore,
  sb: SbLike | null,
  setStore: (s: LocalStore | null) => void,
  renderAuth: () => void,
  route: () => void | Promise<void>,
) {
  const isCloud = store.kind === 'cloud';
  const accGroup = el('div', { class: 'settings-group' }, [
    el('h4', null, 'Режим работы'),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, isCloud ? 'Облако: ' + String(sb?.getSession()?.user?.email ?? '') : 'Демо-режим'),
        el('span', null, isCloud
          ? (store.offline ? 'Сейчас офлайн — данные синхронизируются при появлении сети.' : 'Карточки синхронизируются между устройствами.')
          : 'Данные хранятся только в этом браузере. Настройте Supabase (см. README) для синхронизации.'),
      ]),
      el('button', {
        class: 'btn ghost',
        onclick: async () => {
          const yes = await confirmDialog(isCloud ? 'Выйти из аккаунта?' : 'Выйти из демо-режима?',
            isCloud ? 'Карточки останутся в облаке.' : 'Данные останутся в этом браузере — вы сможете вернуться.',
            'Выйти');
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
      }, 'Выйти'),
    ]),
  ]);

  if (isCloud) {
    accGroup.append(el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Синхронизация'),
        el('span', null, 'Принудительно отправить отложенные изменения в облако.'),
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
            toast(r.ok ? `Синхронизировано: ${r.ok}` : 'Статистика и очередь обновлены', 'ok');
            await route();
          }           catch (e) { toast(e instanceof Error ? e.message : String(e), 'error'); }
        },
      }, 'Синхронизировать'),
    ]));
  }

  return accGroup;
}
