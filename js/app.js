// ============================================================
// КАР-точки — приложение (экраны и логика)
// ============================================================
(function () {
  'use strict';

  const { el, toast, modal, confirmDialog, spinner, plural, CROW_SVG } = UI;
  const { LocalStore, CloudStore, DEFAULT_SETTINGS } = KarStore;

  const FOLDER_COLORS = ['#C4772C', '#7C8DB5', '#4A8F5D', '#B5651D', '#8E6FAE', '#C4453C', '#3E8E9C', '#A98A3B', '#5C5E66'];

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="14" height="12" rx="2.5"/><path d="M8 4.5h11a2 2 0 0 1 2 2V16"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>',
  };

  // ---------- состояние ------------------------------------
  let store = null;
  let sb = null;
  const app = document.getElementById('app');
  const cfg = window.KAR_CONFIG || {};
  const cloudConfigured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  // ---------- маршрутизация (#home, #folder/id, #review, ...) --
  function nav(hash) { location.hash = hash; }

  function route() {
    const h = (location.hash || '#home').slice(1);
    const [name, arg] = h.split('/');
    if (!store) { renderAuth(); return; }
    if (name === 'folder' && arg) renderFolder(arg);
    else if (name === 'review') renderReview(arg || null);
    else if (name === 'settings') renderSettings();
    else renderHome();
  }
  window.addEventListener('hashchange', route);

  // ---------- каркас с навигацией ---------------------------
  function shell(viewName, content) {
    app.innerHTML = '';
    const dueAll = countDue(null);
    const badge = dueAll > 0 ? String(dueAll) : null;

    const tabs = [
      { id: 'home', label: 'Папки', icon: ICONS.home, hash: '#home' },
      { id: 'review', label: 'Повторение', icon: ICONS.cards, hash: '#review', badge },
      { id: 'settings', label: 'Настройки', icon: ICONS.gear, hash: '#settings' },
    ];

    const header = el('header', { class: 'header' },
      el('div', { class: 'header-in' }, [
        el('button', { class: 'brand', onclick: () => nav('#home') }, [
          svgNode(CROW_SVG),
          el('span', null, [el('span', { class: 'kar' }, 'КАР'), '-точки']),
        ]),
        el('nav', { class: 'nav-desktop' }, tabs.map(t =>
          el('button', {
            class: 'nav-btn' + (viewName === t.id ? ' active' : ''),
            onclick: () => nav(t.hash),
          }, [t.label, t.badge ? el('span', { class: 'badge' }, t.badge) : null])
        )),
      ])
    );

    const tabbar = el('div', { class: 'tabbar' }, tabs.map(t =>
      el('button', {
        class: 'tab-btn' + (viewName === t.id ? ' active' : ''),
        onclick: () => nav(t.hash),
      }, [svgNode(t.icon), el('span', null, t.label), t.badge ? el('span', { class: 'badge' }, t.badge) : null])
    ));

    const main = el('main', { class: 'main' }, el('div', { class: 'view' }, content));
    app.append(header, main, tabbar);
    window.scrollTo(0, 0);
  }

  function svgNode(svgText) {
    const d = document.createElement('div');
    d.innerHTML = svgText;
    const svg = d.firstChild;
    return svg;
  }

  function crowBox(cls) {
    return el('div', { class: cls || 'crow', html: CROW_SVG });
  }

  // ---------- подсчёты ---------------------------------------
  function cardsOf(folderId) {
    return folderId ? store.cards.filter(c => c.folder_id === folderId) : store.cards.slice();
  }

  function countDue(folderId) {
    if (!store) return 0;
    const algo = store.settings.algo;
    const now = Date.now();
    return cardsOf(folderId).filter(c => SRS.isDue(c, algo, now)).length;
  }

  function countNew(folderId) {
    const algo = store.settings.algo;
    return cardsOf(folderId).filter(c => SRS.isNew(c, algo)).length;
  }

  function newBudget() {
    const s = store.settings;
    let rec = { date: '', count: 0 };
    try { rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}'); } catch (e) {}
    const today = new Date().toDateString();
    if (rec.date !== today) rec = { date: today, count: 0 };
    return Math.max(0, (s.newPerDay || 20) - (rec.count || 0));
  }

  function spendNewBudget() {
    const today = new Date().toDateString();
    let rec = { date: today, count: 0 };
    try {
      rec = JSON.parse(localStorage.getItem('kar_new_today') || '{}');
      if (rec.date !== today) rec = { date: today, count: 0 };
    } catch (e) {}
    rec.count = (rec.count || 0) + 1;
    localStorage.setItem('kar_new_today', JSON.stringify(rec));
  }

  // ==========================================================
  // Экран входа / выбора режима
  // ==========================================================
  function renderAuth(busyMsg) {
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
            'Облачный режим (синхронизация между устройствами) пока не настроен. Как подключить бесплатный Supabase — в файле README.md.'),
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

    content.append(
      cloudCard,
      el('div', { class: 'auth-or' }, '· · ·'),
      demoBtn,
      el('p', { class: 'auth-note' }, 'Демо-режим: данные хранятся только в этом браузере.')
    );

    app.append(el('main', { class: 'main' }, content));
  }

  async function enterLocal() {
    store = new LocalStore();
    await store.init();
    if (!store.folders.length && !localStorage.getItem('kar_seeded')) {
      localStorage.setItem('kar_seeded', '1');
      const f = await store.createFolder({ name: 'Первая папка', color: FOLDER_COLORS[0] });
      await store.createCard({ folder_id: f.id, front: 'КАР-точки', back: 'Карточки для запоминания.\nНажмите на карточку, чтобы перевернуть.' });
    }
    nav('#home'); route();
  }

  async function enterCloud() {
    localStorage.setItem('kar_mode', 'cloud');
    renderAuth('Загружаю ваши карточки…');
    try {
      store = new CloudStore(sb);
      await store.init();
      nav('#home'); route();
    } catch (e) {
      store = null;
      toast('Не удалось загрузить данные: ' + e.message, 'error');
      renderAuth();
    }
  }

  // ==========================================================
  // Главная — папки
  // ==========================================================
  function renderHome() {
    const dueAll = countDue(null);
    const newAll = Math.min(countNew(null), newBudget());
    const totalToStudy = dueAll + newAll;

    const hero = el('div', { class: 'review-hero' }, [
      crowBox('crow'),
      el('div', { class: 'grow' }, [
        el('h2', null, totalToStudy > 0
          ? `К повторению: ${totalToStudy} ${plural(totalToStudy, 'карточка', 'карточки', 'карточек')}`
          : 'Всё повторено. Кар!'),
        el('p', null, totalToStudy > 0
          ? 'Ворона ждёт — пара минут, и память скажет спасибо.'
          : 'Добавьте новые слова или загляните позже.'),
      ]),
      totalToStudy > 0
        ? el('button', { class: 'btn accent big', onclick: () => nav('#review') }, [svgNode(ICONS.play), 'Повторить'])
        : null,
    ]);

    const grid = el('div', { class: 'folder-grid' });
    store.folders.forEach((f, i) => {
      const n = cardsOf(f.id).length;
      const due = countDue(f.id) + Math.min(countNew(f.id), newBudget());
      const card = el('div', {
        class: 'folder-card', style: { animationDelay: (i * 40) + 'ms' },
        onclick: () => nav('#folder/' + f.id),
      }, [
        el('div', { class: 'swatch', style: { background: f.color } }, initials(f.name)),
        el('h3', null, f.name),
        el('div', { class: 'meta' }, n + ' ' + plural(n, 'карточка', 'карточки', 'карточек')),
        due > 0 ? el('div', { class: 'due-chip' }, due + ' к повторению') : null,
      ]);
      grid.append(card);
    });
    grid.append(el('button', {
      class: 'add-tile', style: { animationDelay: (store.folders.length * 40) + 'ms' },
      onclick: () => folderDialog(),
    }, '+ Новая папка'));

    const content = [hero, el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Папки')), grid];

    if (!store.folders.length) {
      content.push(el('div', { class: 'empty' }, [
        crowBox('crow'),
        el('h3', null, 'Пока пусто'),
        el('p', null, 'Создайте папку — например, «Английский» или «Философия».'),
      ]));
    }

    shell('home', el('div', null, content));
  }

  function initials(name) {
    return (name || '?').trim().slice(0, 1).toUpperCase();
  }

  // диалог создания/редактирования папки
  function folderDialog(folder) {
    let color = folder ? folder.color : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
    const name = el('input', { class: 'input', value: folder ? folder.name : '', placeholder: 'Например, Английский' });
    const dots = el('div', { class: 'color-row' }, FOLDER_COLORS.map(c =>
      el('button', {
        class: 'color-dot' + (c === color ? ' sel' : ''), style: { background: c },
        onclick: e => {
          color = c;
          dots.querySelectorAll('.color-dot').forEach(d => d.classList.remove('sel'));
          e.currentTarget.classList.add('sel');
        },
      })
    ));

    let m;
    const save = el('button', {
      class: 'btn primary',
      onclick: async () => {
        const nm = name.value.trim();
        if (!nm) { toast('Введите название', 'error'); return; }
        save.disabled = true;
        try {
          if (folder) await store.updateFolder(folder.id, { name: nm, color });
          else await store.createFolder({ name: nm, color });
          m.close(); route();
        } catch (e) { toast(e.message, 'error'); save.disabled = false; }
      },
    }, folder ? 'Сохранить' : 'Создать');

    m = modal(el('div', null, [
      el('h3', { class: 'modal-title' }, folder ? 'Папка' : 'Новая папка'),
      el('div', { class: 'field' }, [el('label', null, 'Название'), name]),
      el('div', { class: 'field' }, [el('label', null, 'Цвет'), dots]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
        save,
      ]),
    ]));
    setTimeout(() => name.focus(), 260);
  }

  // ==========================================================
  // Папка — список карточек
  // ==========================================================
  function renderFolder(folderId) {
    const folder = store.folders.find(f => f.id === folderId);
    if (!folder) { nav('#home'); return; }
    const cards = cardsOf(folderId);
    const due = countDue(folderId) + Math.min(countNew(folderId), newBudget());
    const algo = store.settings.algo;

    const head = el('div', { class: 'page-head' }, [
      el('button', { class: 'icon-btn', onclick: () => nav('#home') }, svgNode(ICONS.back)),
      el('div', { class: 'swatch', style: { background: folder.color, width: '30px', height: '30px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: '800', fontSize: '13px' } }, initials(folder.name)),
      el('h2', { class: 'page-title grow' }, folder.name),
      el('button', { class: 'icon-btn', title: 'Переименовать', onclick: () => folderDialog(folder) }, svgNode(ICONS.pencil)),
      el('button', {
        class: 'icon-btn', title: 'Удалить папку',
        onclick: async () => {
          const yes = await confirmDialog('Удалить папку?',
            `«${folder.name}» и все её карточки (${cards.length}) будут удалены навсегда.`, 'Удалить', true);
          if (!yes) return;
          await store.deleteFolder(folderId);
          toast('Папка удалена');
          nav('#home');
        },
      }, svgNode(ICONS.trash)),
    ]);

    const actions = el('div', { class: 'row', style: { marginBottom: '18px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn primary', onclick: () => cardDialog(folderId) }, [svgNode(ICONS.plus), 'Добавить карточку']),
      due > 0 ? el('button', { class: 'btn accent', onclick: () => nav('#review/' + folderId) }, [svgNode(ICONS.play), `Повторить (${due})`]) : null,
    ]);

    const list = el('div', { class: 'card-list' });
    cards.forEach((c, i) => {
      list.append(cardRow(c, i));
    });

    const content = [head, actions, list];
    if (!cards.length) {
      content.push(el('div', { class: 'empty' }, [
        crowBox('crow'),
        el('h3', null, 'В папке пусто'),
        el('p', null, 'Добавьте первое слово, термин или цитату.'),
      ]));
    }

    shell('home', el('div', null, content));

    function cardRow(c, i) {
      const img = c.front_img || c.back_img;
      let chip;
      if (SRS.isNew(c, algo)) chip = el('span', { class: 'srs-chip new' }, 'новая');
      else if (SRS.isDue(c, algo)) chip = el('span', { class: 'srs-chip due' }, 'пора');
      else {
        const d = SRS.dueOf(c, algo);
        chip = el('span', { class: 'srs-chip' }, 'через ' + SRS.fmtDays(Math.max(1, Math.round((d - Date.now()) / 86400000))));
      }
      const row = el('div', {
        class: 'card-row', style: { animationDelay: Math.min(i * 30, 400) + 'ms' },
        onclick: () => cardDialog(c.folder_id, c),
      }, [
        img ? el('img', { class: 'thumb', src: img, alt: '' }) : null,
        el('div', { class: 'texts' }, [
          el('div', { class: 'front' }, c.front || '(картинка)'),
          el('div', { class: 'back' }, c.back || ''),
        ]),
        chip,
        el('button', {
          class: 'icon-btn', title: 'Удалить',
          onclick: async e => {
            e.stopPropagation();
            const yes = await confirmDialog('Удалить карточку?', textPreview(c), 'Удалить', true);
            if (!yes) return;
            row.classList.add('removing');
            setTimeout(async () => {
              await store.deleteCard(c.id);
              route();
              toast('Карточка удалена');
            }, 250);
          },
        }, svgNode(ICONS.trash)),
      ]);
      return row;
    }
  }

  function textPreview(c) {
    const t = (c.front || '') + (c.back ? ' — ' + c.back : '');
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }

  // ==========================================================
  // Редактор карточки
  // ==========================================================
  function cardDialog(folderId, card) {
    const state = {
      front: card ? card.front : '',
      back: card ? card.back : '',
      front_img: card ? card.front_img : null,
      back_img: card ? card.back_img : null,
    };

    const frontTa = el('textarea', { class: 'input', placeholder: 'Слово, термин или начало цитаты', rows: 2 }, state.front);
    const backTa = el('textarea', { class: 'input', placeholder: 'Перевод, определение или продолжение', rows: 2 }, state.back);

    function imgDrop(side) {
      const box = el('div', { class: 'img-drop' });
      const input = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });

      function paint() {
        box.innerHTML = '';
        if (state[side]) {
          box.append(
            el('img', { src: state[side], alt: '' }),
            el('button', {
              class: 'img-x', title: 'Убрать картинку',
              onclick: e => { e.stopPropagation(); state[side] = null; paint(); },
            }, '✕')
          );
        } else {
          box.append(el('span', null, '+ Картинка'), input);
        }
      }

      async function handleFile(file) {
        if (!file) return;
        box.innerHTML = '';
        box.append(spinner());
        try {
          state[side] = await store.uploadImage(file);
        } catch (e) { toast(e.message, 'error'); }
        paint();
      }

      box.addEventListener('click', () => { if (!state[side]) input.click(); });
      input.addEventListener('change', () => handleFile(input.files[0]));
      box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', () => box.classList.remove('drag'));
      box.addEventListener('drop', e => {
        e.preventDefault(); box.classList.remove('drag');
        handleFile(e.dataTransfer.files[0]);
      });
      paint();
      return box;
    }

    let m;
    const save = el('button', {
      class: 'btn primary',
      onclick: async () => {
        const front = frontTa.value.trim();
        const back = backTa.value.trim();
        if (!front && !state.front_img) { toast('Заполните лицевую сторону', 'error'); return; }
        save.disabled = true;
        try {
          const patch = { front, back, front_img: state.front_img, back_img: state.back_img };
          if (card) await store.updateCard(card.id, patch);
          else await store.createCard(Object.assign({ folder_id: folderId }, patch));
          m.close(); route();
          if (!card) toast('Карточка добавлена', 'ok');
        } catch (e) { toast(e.message, 'error'); save.disabled = false; }
      },
    }, card ? 'Сохранить' : 'Добавить');

    const actions = [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      save,
    ];

    m = modal(el('div', null, [
      el('h3', { class: 'modal-title' }, card ? 'Карточка' : 'Новая карточка'),
      el('div', { class: 'editor-sides' }, [
        el('div', { class: 'side-box' }, [
          el('div', { class: 'side-title' }, 'Лицо'),
          frontTa, imgDrop('front_img'),
        ]),
        el('div', { class: 'side-box' }, [
          el('div', { class: 'side-title' }, 'Оборот'),
          backTa, imgDrop('back_img'),
        ]),
      ]),
      el('div', { class: 'modal-actions' }, actions),
    ]), { wide: true });
    if (!card) setTimeout(() => frontTa.focus(), 260);
  }

  // ==========================================================
  // Повторение
  // ==========================================================
  function renderReview(folderId) {
    const algo = store.settings.algo;
    const now = Date.now();
    const pool = cardsOf(folderId);

    const dueCards = shuffle(pool.filter(c => SRS.isDue(c, algo, now)));
    const newCards = shuffle(pool.filter(c => SRS.isNew(c, algo))).slice(0, newBudget());
    const queue = shuffle(dueCards.concat(newCards));

    const folder = folderId ? store.folders.find(f => f.id === folderId) : null;

    if (!queue.length) {
      shell('review', el('div', { class: 'review-done' }, [
        crowBox('crow'),
        el('h2', null, 'Кар! Всё повторено'),
        el('p', null, pool.length
          ? 'Сейчас нет карточек к повторению. Загляните позже — ворона напомнит точками.'
          : 'Здесь пока нет карточек — добавьте первые слова.'),
        el('button', { class: 'btn primary big', onclick: () => nav('#home') }, 'К папкам'),
      ]));
      return;
    }

    const total = queue.length;
    let done = 0;
    let currentIsNew = false;

    const wrap = el('div', { class: 'review-wrap' });
    const bar = el('div', null);
    const counter = el('span', { class: 'review-count' }, '');
    const top = el('div', { class: 'review-top' }, [
      el('button', { class: 'icon-btn', onclick: () => nav(folderId ? '#folder/' + folderId : '#home') }, svgNode(ICONS.back)),
      el('div', { class: 'progress' }, bar),
      counter,
    ]);
    const stage = el('div', null);
    wrap.append(top, stage);
    shell('review', el('div', null, [
      folder ? el('p', { class: 'page-sub', style: { textAlign: 'center' } }, 'Папка: ' + folder.name) : null,
      wrap,
    ]));

    showNext(true);

    function updateBar() {
      bar.style.width = Math.round(done / total * 100) + '%';
      counter.textContent = done + ' / ' + total;
    }

    function pickSide(card) {
      const dir = store.settings.direction;
      if (dir === 'btf') return 'back';
      if (dir === 'mixed') return Math.random() < 0.5 ? 'front' : 'back';
      return 'front';
    }

    function showNext(first) {
      updateBar();
      if (!queue.length) { finish(); return; }
      const card = queue[0];
      currentIsNew = SRS.isNew(card, algo);
      const firstSide = pickSide(card);
      const node = cardNode(card, firstSide);
      if (!first) node.classList.add('card-swap-in');
      stage.innerHTML = '';
      stage.append(node);
    }

    function cardNode(card, firstSide) {
      const backSide = firstSide === 'front' ? 'back' : 'front';
      let flipped = false;

      const face = (side, isBack) => {
        const text = card[side === 'front' ? 'front' : 'back'];
        const img = card[side === 'front' ? 'front_img' : 'back_img'];
        return el('div', { class: 'flip-face' + (isBack ? ' backside' : '') }, [
          el('div', { class: 'side-label' }, side === 'front' ? 'лицо' : 'оборот'),
          img ? el('img', { src: img, alt: '' }) : null,
          text ? el('div', { class: 'word' + (text.length > 60 ? ' small' : '') }, text) : null,
        ]);
      };

      const flip = el('div', { class: 'flip-card' }, [face(firstSide, false), face(backSide, true)]);
      const hint = el('div', { class: 'flip-hint' }, 'Нажмите на карточку, чтобы перевернуть');
      const grades = el('div', { class: 'grade-row' });
      const box = el('div', { class: 'flip-scene' }, [flip, hint, grades]);

      function doFlip() {
        if (flipped) return;
        flipped = true;
        flip.classList.add('flipped');
        hint.style.opacity = '0';
        renderGrades();
      }
      flip.addEventListener('click', doFlip);

      function renderGrades() {
        grades.innerHTML = '';
        if (algo === 'leitner') {
          const ivs = store.settings.leitnerIntervals;
          grades.append(
            gradeBtn('Не помню', SRS.leitnerPreview(card, false, ivs), 'again', () => grade(card, { leitner: false })),
            gradeBtn('Помню', SRS.leitnerPreview(card, true, ivs), 'good', () => grade(card, { leitner: true })),
          );
        } else {
          grades.append(
            gradeBtn('Снова', SRS.sm2Preview(card, 0), 'again', () => grade(card, { q: 0 })),
            gradeBtn('Трудно', SRS.sm2Preview(card, 3), 'hard', () => grade(card, { q: 3 })),
            gradeBtn('Хорошо', SRS.sm2Preview(card, 4), 'good', () => grade(card, { q: 4 })),
            gradeBtn('Легко', SRS.sm2Preview(card, 5), 'easy', () => grade(card, { q: 5 })),
          );
        }
      }

      function gradeBtn(label, sub, cls, fn) {
        return el('button', { class: 'grade-btn ' + cls, onclick: fn }, [label, el('small', null, sub)]);
      }

      // клавиатура: пробел — перевернуть, 1–4 — оценка
      box.tabIndex = -1;
      const onKey = e => {
        if (!stage.contains(box)) { document.removeEventListener('keydown', onKey); return; }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doFlip(); }
        if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
          const btns = grades.querySelectorAll('.grade-btn');
          const i = Number(e.key) - 1;
          if (btns[i]) btns[i].click();
        }
      };
      document.addEventListener('keydown', onKey);

      return box;
    }

    async function grade(card, g) {
      let patch, failed;
      if (algo === 'leitner') {
        patch = SRS.leitnerNext(card, g.leitner, store.settings.leitnerIntervals);
        failed = !g.leitner;
      } else {
        patch = SRS.sm2Next(card, g.q);
        failed = g.q < 3;
      }
      if (currentIsNew) spendNewBudget();

      queue.shift();
      if (failed) {
        // забытая карточка вернётся в этой же сессии
        const pos = Math.min(3, queue.length);
        queue.splice(pos, 0, Object.assign({}, card, patch));
      } else {
        done++;
      }

      const cur = stage.firstChild;
      if (cur) cur.classList.add('card-swap-out');

      try { await store.updateCard(card.id, patch); }
      catch (e) { toast('Не сохранилось: ' + e.message, 'error'); }

      setTimeout(() => showNext(false), 240);
    }

    function finish() {
      updateBar();
      const praise = ['Кар-кар! Отличная работа', 'Готово. Ворона гордится вами', 'Сессия завершена'];
      stage.innerHTML = '';
      stage.append(el('div', { class: 'review-done' }, [
        crowBox('crow'),
        el('h2', null, praise[Math.floor(Math.random() * praise.length)]),
        el('p', null, `Повторено карточек: ${total}. Следующие появятся по расписанию.`),
        el('button', { class: 'btn primary big', onclick: () => nav('#home') }, 'К папкам'),
      ]));
    }
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ==========================================================
  // Настройки
  // ==========================================================
  function renderSettings() {
    const s = store.settings;

    async function save() {
      try { await store.saveSettings(s); }
      catch (e) { toast('Не сохранилось: ' + e.message, 'error'); }
    }

    function segControl(value, options, onChange) {
      const seg = el('div', { class: 'seg' });
      options.forEach(o => {
        const b = el('button', { class: o.v === value ? 'active' : '' }, o.label);
        b.addEventListener('click', () => {
          seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          onChange(o.v);
        });
        seg.append(b);
      });
      return seg;
    }

    // --- алгоритм ---
    const algoGroup = el('div', { class: 'settings-group' }, [
      el('h4', null, 'Интервальное повторение'),
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, 'Алгоритм'),
          el('span', null, 'SM-2 — гибкий, как в Anki. Лейтнер — простые «коробки». Прогресс каждого хранится отдельно.'),
        ]),
        segControl(s.algo, [{ v: 'sm2', label: 'SM-2' }, { v: 'leitner', label: 'Лейтнер' }], v => { s.algo = v; save(); renderSettings(); }),
      ]),
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, 'Направление'),
          el('span', null, 'Какую сторону карточки показывать первой.'),
        ]),
        segControl(s.direction, [
          { v: 'ftb', label: 'Лицо' }, { v: 'btf', label: 'Оборот' }, { v: 'mixed', label: 'Вперемешку' },
        ], v => { s.direction = v; save(); }),
      ]),
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, 'Новых карточек в день'),
          el('span', null, 'Чтобы не перегружаться в начале.'),
        ]),
        (() => {
          const inp = el('input', { type: 'number', min: 1, max: 500, value: s.newPerDay });
          inp.addEventListener('change', () => { s.newPerDay = Math.max(1, Number(inp.value) || 20); save(); });
          return inp;
        })(),
      ]),
    ]);

    // интервалы Лейтнера
    if (s.algo === 'leitner') {
      const row = el('div', { class: 'row', style: { flexWrap: 'wrap' } });
      s.leitnerIntervals.forEach((d, i) => {
        const inp = el('input', { type: 'number', min: 1, max: 365, value: d, style: { width: '64px', textAlign: 'center' }, class: 'input' });
        inp.addEventListener('change', () => {
          s.leitnerIntervals[i] = Math.max(1, Number(inp.value) || 1);
          save();
        });
        row.append(el('div', { style: { textAlign: 'center' } }, [
          el('div', { class: 'muted' }, 'Кор. ' + (i + 1)),
          inp,
        ]));
      });
      algoGroup.append(el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, 'Интервалы коробок (дни)'),
          el('span', null, 'Через сколько дней показывать карточку из каждой коробки.'),
        ]),
        row,
      ]));
    }

    // --- данные ---
    const importInput = el('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
    importInput.addEventListener('change', async () => {
      const f = importInput.files[0];
      if (!f) return;
      try {
        await store.importJSON(await f.text());
        toast('Импорт завершён', 'ok');
        route();
      } catch (e) { toast('Импорт не удался: ' + e.message, 'error'); }
    });

    const dataGroup = el('div', { class: 'settings-group' }, [
      el('h4', null, 'Данные'),
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, 'Экспорт'),
          el('span', null, 'Скачать все папки и карточки одним файлом (резервная копия).'),
        ]),
        el('button', {
          class: 'btn',
          onclick: () => {
            const blob = new Blob([store.exportJSON()], { type: 'application/json' });
            const a = el('a', { href: URL.createObjectURL(blob), download: 'kartochki-backup.json' });
            document.body.append(a); a.click(); a.remove();
          },
        }, 'Скачать'),
      ]),
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, 'Импорт'),
          el('span', null, 'Загрузить файл экспорта — например, перенести карточки из демо-режима в облако.'),
        ]),
        el('button', { class: 'btn', onclick: () => importInput.click() }, 'Выбрать файл'),
        importInput,
      ]),
    ]);

    // --- аккаунт / режим ---
    const isCloud = store.kind === 'cloud';
    const accGroup = el('div', { class: 'settings-group' }, [
      el('h4', null, 'Режим работы'),
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, isCloud ? 'Облако: ' + (sb.session && sb.session.user ? sb.session.user.email : '') : 'Демо-режим'),
          el('span', null, isCloud
            ? 'Карточки синхронизируются между устройствами.'
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
            store = null;
            nav('#home');
            renderAuth();
          },
        }, 'Выйти'),
      ]),
    ]);

    const about = el('p', { class: 'muted', style: { textAlign: 'center', margin: '26px 0 8px' } },
      'КАР-точки · ворона помнит всё');

    shell('settings', el('div', null, [
      el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Настройки')),
      algoGroup, dataGroup, accGroup, about,
    ]));
  }

  // ==========================================================
  // Запуск
  // ==========================================================
  async function boot() {
    if (cloudConfigured) sb = new MiniSupabase(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const mode = localStorage.getItem('kar_mode');
    try {
      if (mode === 'local') {
        await enterLocal();
      } else if (mode === 'cloud' && sb && await sb.ensureFresh()) {
        store = new CloudStore(sb);
        await store.init();
        route();
      } else {
        renderAuth();
      }
    } catch (e) {
      console.error(e);
      toast('Ошибка запуска: ' + e.message, 'error');
      renderAuth();
    }
  }

  boot();

  // PWA: service worker (работает только по https или на localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
