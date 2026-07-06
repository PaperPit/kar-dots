import { el, toast, confirmDialog } from '../../../ui/ui.js';
import { nav } from '../../../ui/shell.js';

export function buildAccountGroup(store, sb, setStore, renderAuth, route) {
  const isCloud = store.kind === 'cloud';
  const accGroup = el('div', { class: 'settings-group' }, [
    el('h4', null, 'Режим работы'),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, isCloud ? 'Облако: ' + (sb.session && sb.session.user ? sb.session.user.email : '') : 'Демо-режим'),
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
          if (isCloud) await sb.signOut();
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
            const r = await store.flushSync();
            toast(r.ok ? `Синхронизировано: ${r.ok}` : 'Нечего синхронизировать', 'ok');
            await route();
          } catch (e) { toast(e.message, 'error'); }
        },
      }, 'Синхронизировать'),
    ]));
  }

  return accGroup;
}
