import { store, sb, cloudConfigured, app, setStore } from '../../core/state.js';
import { el, toast, spinner } from '../../ui/ui.js';
import { LocalStore } from '../../data/index.js';
import { FOLDER_COLORS } from '../../ui/constants.js';
import { brandMark, ghostBox } from '../../ui/helpers.js';
import { nav } from '../../ui/shell.js';
import { route, parseHash } from '../../core/router.js';
import { animateFadeIn } from '../../lib/motion-ui.js';
import type { CloudStore } from '../../data/store-cloud.js';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** После фоновой синхронизации перерисовать экран (кроме активной сессии повторения). */
export function attachCloudDataReload(cloud: CloudStore) {
  cloud.onDataChange(() => {
    if (parseHash(location.hash).name === 'review') return;
    route();
  });
}

export function renderAuth(busyMsg?: string) {
  if (!app) return;
  app.innerHTML = '';
  const content = el('div', { class: 'auth-wrap' }, []);
  content.append(
    ghostBox(),
    brandMark({ heading: true }),
    el('p', { class: 'auth-sub' }, 'Карточки для запоминания слов, терминов и цитат — с умным интервальным повторением.')
  );

  if (busyMsg) {
    content.append(el('div', { class: 'center-pad' }, [spinner(undefined), el('p', { class: 'auth-note' }, busyMsg)]));
    app.append(el('main', { class: 'main' }, content));
    requestAnimationFrame(() => animateFadeIn(content));
    return;
  }

  const email = el('input', { class: 'input', type: 'email', placeholder: 'Почта', autocomplete: 'email' }, []) as HTMLInputElement;
  const pass = el('input', { class: 'input', type: 'password', placeholder: 'Пароль (мин. 6 символов)', autocomplete: 'current-password' }, []) as HTMLInputElement;
  const btnIn = el('button', { class: 'btn primary block big' }, 'Войти') as HTMLButtonElement;
  const btnUp = el('button', { class: 'link-btn' }, 'Создать аккаунт') as HTMLButtonElement;

  async function doAuth(signup: boolean) {
    if (!email.value.trim() || pass.value.length < 6) {
      toast('Введите почту и пароль не короче 6 символов', 'error'); return;
    }
    btnIn.disabled = true;
    try {
      if (!sb) { btnIn.disabled = false; return; }
      if (signup) {
        const r = await sb.signUp(email.value.trim(), pass.value);
        if (r.needConfirm) {
          toast('Письмо отправлено — подтвердите почту и войдите', 'ok');
          btnIn.disabled = false;
          return;
        }
      } else {
        await sb.signIn(email.value.trim(), pass.value);
      }
      await enterCloud();
    } catch (e) {
      toast(errMsg(e), 'error');
      btnIn.disabled = false;
    }
  }
  btnIn.addEventListener('click', () => doAuth(false));
  btnUp.addEventListener('click', () => doAuth(true));
  pass.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') doAuth(false); });

  const cloudCard = el('div', { class: 'auth-card' }, cloudConfigured
    ? [
        el('div', { class: 'field' }, email),
        el('div', { class: 'field' }, pass),
        btnIn,
        el('p', { class: 'auth-note' }, ['Нет аккаунта? ', btnUp]),
      ]
    : [
        el('p', { class: 'modal-text modal-text-flush' },
          'Облачный режим пока не настроен. Скопируйте js/config.example.js → js/config.js и заполните ключи Supabase (см. docs/USER-GUIDE.md).'),
      ]
  );

  const demoBtn = el('button', {
    class: 'btn block big',
    onclick: async () => {
      localStorage.setItem('kar_mode', 'local');
      renderAuth('Открываю…');
      await enterLocal();
    },
  }, 'Попробовать без регистрации') as HTMLButtonElement;

  content.append(cloudCard, el('div', { class: 'auth-or' }, '· · ·'), demoBtn,
    el('p', { class: 'auth-note' }, 'Демо-режим: данные хранятся только в этом браузере.'));
  app.append(el('main', { class: 'main' }, content));
  requestAnimationFrame(() => animateFadeIn(content));
}

export async function enterLocal() {
  const local = new LocalStore();
  await local.init();
  setStore(local);
  if (!store.folders.length && !localStorage.getItem('kar_seeded')) {
    localStorage.setItem('kar_seeded', '1');
    const f = await local.createFolder({ name: 'Первая папка', color: FOLDER_COLORS[0] });
    await local.createCard({ folder_id: f.id, front: 'КАР-точки', back: 'Карточки для запоминания.\nНажмите на карточку, чтобы перевернуть.' });
  }
  nav('#home');
  await route();
}

export async function enterCloud() {
  localStorage.setItem('kar_mode', 'cloud');
  renderAuth('Загружаю ваши карточки…');
  try {
    const { CloudStore } = await import('../../data/store-cloud.js');
    if (!sb) throw new Error('Облачный режим не настроен (нет ключей Supabase)');
    const cloud = new CloudStore(sb);
    await cloud.init();
    setStore(cloud);
    attachCloudDataReload(cloud);
    // Первое устройство / пустое зеркало: не уходим на пустой home, пока облако не ответит.
    if (navigator.onLine && !cloud.folders.length && !cloud.boxes.length) {
      await cloud.whenCloudReady();
    }
    if (navigator.onLine) {
      await cloud.whenCloudReady();
      await cloud.syncActivityNow();
    }
    nav('#home');
    await route();
    } catch (e) {
      setStore(null);
      toast('Не удалось загрузить данные: ' + errMsg(e), 'error');
      renderAuth();
    }
}
