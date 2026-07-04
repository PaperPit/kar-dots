import { store, sb, cloudConfigured, app, setStore } from '../../core/state.js';
import { el, toast, spinner } from '../../ui/ui.js';
import { LocalStore, CloudStore } from '../../data/index.js';
import { FOLDER_COLORS } from '../../ui/constants.js';
import { crowBox } from '../../ui/helpers.js';
import { nav } from '../../ui/shell.js';
import { route } from '../../core/router.js';

export function renderAuth(busyMsg) {
  app.innerHTML = '';
  const content = el('div', { class: 'auth-wrap' });
  content.append(
    crowBox('auth-logo'),
    el('h1', { class: 'auth-title' }, [el('span', { class: 'kar' }, 'КАР'), '-точки']),
    el('p', { class: 'auth-sub' }, 'Карточки для запоминания слов, терминов и цитат — с умным интервальным повторением.')
  );

  if (busyMsg) {
    content.append(el('div', { class: 'center-pad' }, [spinner(), el('p', { class: 'auth-note' }, busyMsg)]));
    app.append(el('main', { class: 'main' }, content));
    return;
  }

  const email = el('input', { class: 'input', type: 'email', placeholder: 'Почта', autocomplete: 'email' });
  const pass = el('input', { class: 'input', type: 'password', placeholder: 'Пароль (мин. 6 символов)', autocomplete: 'current-password' });
  const btnIn = el('button', { class: 'btn primary block big' }, 'Войти');
  const btnUp = el('button', { class: 'link-btn' }, 'Создать аккаунт');

  async function doAuth(signup) {
    if (!email.value.trim() || pass.value.length < 6) {
      toast('Введите почту и пароль не короче 6 символов', 'error'); return;
    }
    btnIn.disabled = true;
    try {
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
      toast(e.message, 'error');
      btnIn.disabled = false;
    }
  }
  btnIn.addEventListener('click', () => doAuth(false));
  btnUp.addEventListener('click', () => doAuth(true));
  pass.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(false); });

  const cloudCard = el('div', { class: 'auth-card' }, cloudConfigured
    ? [
        el('div', { class: 'field' }, email),
        el('div', { class: 'field' }, pass),
        btnIn,
        el('p', { class: 'auth-note' }, ['Нет аккаунта? ', btnUp]),
      ]
    : [
        el('p', { class: 'modal-text', style: { margin: 0 } },
          'Облачный режим пока не настроен. Скопируйте js/config.example.js → js/config.js и заполните ключи Supabase (см. README.md).'),
      ]
  );

  const demoBtn = el('button', {
    class: 'btn block big',
    onclick: async () => {
      localStorage.setItem('kar_mode', 'local');
      renderAuth('Открываю…');
      await enterLocal();
    },
  }, 'Попробовать без регистрации');

  content.append(cloudCard, el('div', { class: 'auth-or' }, '· · ·'), demoBtn,
    el('p', { class: 'auth-note' }, 'Демо-режим: данные хранятся только в этом браузере.'));
  app.append(el('main', { class: 'main' }, content));
}

export async function enterLocal() {
  const local = new LocalStore();
  await local.init();
  setStore(local);
  if (!local.folders.length && !localStorage.getItem('kar_seeded')) {
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
    const cloud = new CloudStore(sb);
    await cloud.init();
    setStore(cloud);
    nav('#home');
    await route();
  } catch (e) {
    setStore(null);
    toast('Не удалось загрузить данные: ' + e.message, 'error');
    renderAuth();
  }
}
