// ============================================================
// КАР-точки — экран входа / выбора режима (демо или облако)
// ============================================================
(function () {
  'use strict';

  const { el, toast, spinner } = UI;

  function render(busyMsg) {
    const appEl = document.getElementById('app');
    appEl.innerHTML = '';
    const content = el('div', { class: 'auth-wrap' });

    content.append(
      App.crowBox('auth-logo'),
      el('h1', { class: 'auth-title' }, [el('span', { class: 'kar' }, 'КАР'), '-точки']),
      el('p', { class: 'auth-sub' }, 'Карточки для запоминания слов, терминов и цитат — с умным интервальным повторением.')
    );

    if (busyMsg) {
      content.append(el('div', { class: 'center-pad' }, [spinner(), el('p', { class: 'auth-note' }, busyMsg)]));
      appEl.append(el('main', { class: 'main' }, content));
      return;
    }

    // --- облачный вход ---
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
          const r = await App.sb.signUp(email.value.trim(), pass.value);
          if (r.needConfirm) {
            toast('Письмо отправлено — подтвердите почту и войдите', 'ok');
            btnIn.disabled = false;
            return;
          }
        } else {
          await App.sb.signIn(email.value.trim(), pass.value);
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

    const cloudCard = el('div', { class: 'auth-card' }, App.cloudConfigured
      ? [
          el('div', { class: 'field' }, email),
          el('div', { class: 'field' }, pass),
          btnIn,
          el('p', { class: 'auth-note' }, ['Нет аккаунта? ', btnUp]),
        ]
      : [
          el('p', { class: 'modal-text', style: { margin: 0 } },
            'Облачный режим (синхронизация между устройствами) пока не настроен. Как подключить бесплатный Supabase — в файле README.md.'),
        ]
    );

    const demoBtn = el('button', {
      class: 'btn block big',
      onclick: async () => {
        localStorage.setItem('kar_mode', 'local');
        render('Открываю…');
        await enterLocal();
      },
    }, 'Попробовать без регистрации');

    content.append(
      cloudCard,
      el('div', { class: 'auth-or' }, '· · ·'),
      demoBtn,
      el('p', { class: 'auth-note' }, 'Демо-режим: данные хранятся только в этом браузере.')
    );

    appEl.append(el('main', { class: 'main' }, content));
  }

  async function enterLocal() {
    App.store = new KarStore.LocalStore();
    await App.store.init();
    if (!App.store.folders.length && !localStorage.getItem('kar_seeded')) {
      localStorage.setItem('kar_seeded', '1');
      const f = await App.store.createFolder({ name: 'Первая папка', color: App.FOLDER_COLORS[0] });
      await App.store.createCard({ folder_id: f.id, front: 'КАР-точки', back: 'Карточки для запоминания.\nНажмите на карточку, чтобы перевернуть.' });
    }
    App.nav('#home'); App.route();
  }

  async function enterCloud() {
    localStorage.setItem('kar_mode', 'cloud');
    render('Загружаю ваши карточки…');
    try {
      App.store = new KarStore.CloudStore(App.sb);
      await App.store.init();
      App.nav('#home'); App.route();
    } catch (e) {
      App.store = null;
      toast('Не удалось загрузить данные: ' + e.message, 'error');
      render();
    }
  }

  Screens.auth = { render, enterLocal, enterCloud };
})();
