import { el, toast, confirmDialog, plural } from '../../../ui/ui.js';
import { nav } from '../../../ui/shell.js';

const DEAD_LETTER_LABELS = {
  createFolder: 'Создание папки',
  updateFolder: 'Изменение папки',
  deleteFolder: 'Удаление папки',
  createBox: 'Создание коробки',
  updateBox: 'Изменение коробки',
  deleteBox: 'Удаление коробки',
  createCard: 'Создание карточки',
  updateCard: 'Изменение карточки',
  deleteCard: 'Удаление карточки',
  saveSettings: 'Сохранение настроек',
  uploadImage: 'Загрузка картинки',
};

function fmtFailedAt(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

function buildDeadLettersBlock(store, route, items) {
  return el('div', { class: 'setting-row dead-letter-block' }, [
    el('div', { class: 'lab' }, [
      el('b', null, `Не сохранилось в облаке: ${items.length} ${plural(items.length, 'изменение', 'изменения', 'изменений')}`),
      el('span', null, 'Это не проблема сети — сервер отклонил операцию. Повторите попытку или отмените правку.'),
    ]),
    el('div', { class: 'dead-letter-list' }, items.map(item => el('div', { class: 'dead-letter-row' }, [
      el('div', { class: 'dead-letter-info' }, [
        el('b', null, DEAD_LETTER_LABELS[item.op] || item.op),
        el('span', null, fmtFailedAt(item.failed_at)),
        item.error ? el('span', { class: 'dead-letter-error' }, item.error) : null,
      ]),
      el('div', { class: 'dead-letter-actions' }, [
        el('button', {
          class: 'btn ghost',
          onclick: async () => {
            await store.retryDeadLetterSync(item.id);
            toast('Отправлено ещё раз', 'ok');
            await route();
          },
        }, 'Повторить'),
        el('button', {
          class: 'btn ghost',
          onclick: async () => {
            const yes = await confirmDialog('Отменить это изменение?', 'Оно не будет сохранено в облаке.', 'Отменить');
            if (!yes) return;
            await store.discardDeadLetterSync(item.id);
            toast('Изменение отменено', 'ok');
            await route();
          },
        }, 'Отменить'),
      ]),
    ]))),
  ]);
}

export async function buildAccountGroup(store, sb, setStore, renderAuth, route) {
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

    const deadLetters = typeof store.deadLetters === 'function' ? await store.deadLetters() : [];
    if (deadLetters.length) {
      accGroup.append(buildDeadLettersBlock(store, route, deadLetters));
    }
  }

  return accGroup;
}
