// ============================================================
// КАР-точки — ядро приложения: общее состояние, навигация,
// каркас экрана и мелкие расчёты, общие для всех экранов.
//
// window.App    — состояние (store, sb) + общие хелперы
// window.Screens — сюда каждый экран (js/screens/*.js) кладёт
//                  свою функцию render(...)
// ============================================================
(function () {
  'use strict';

  const { el } = UI;

  const FOLDER_COLORS = ['#C4772C', '#7C8DB5', '#4A8F5D', '#B5651D', '#8E6FAE', '#C4453C', '#3E8E9C', '#A98A3B', '#5C5E66'];

  const appEl = document.getElementById('app');
  const cfg = window.KAR_CONFIG || {};
  const cloudConfigured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  const App = {
    store: null,   // текущее хранилище (LocalStore | CloudStore) — задаётся экраном входа
    sb: null,      // клиент Supabase, если облако настроено
    cfg,
    cloudConfigured,
    FOLDER_COLORS,
    ICONS: window.ICONS,
  };

  const Screens = {};

  window.App = App;
  window.Screens = Screens;

  // ---------- маршрутизация (#home, #folder/id, #review, ...) --
  function nav(hash) { location.hash = hash; }

  function route() {
    const h = (location.hash || '#home').slice(1);
    const [name, arg] = h.split('/');
    if (!App.store) { Screens.auth.render(); return; }
    if (name === 'folder' && arg) Screens.folder.render(arg);
    else if (name === 'review') Screens.review.render(arg || null);
    else if (name === 'settings') Screens.settings.render();
    else Screens.home.render();
  }
  window.addEventListener('hashchange', route);

  // ---------- каркас с навигацией ---------------------------
  function shell(viewName, content) {
    appEl.innerHTML = '';
    const dueAll = App.countDue(null);
    const badge = dueAll > 0 ? String(dueAll) : null;

    const tabs = [
      { id: 'home', label: 'Папки', icon: App.ICONS.home, hash: '#home' },
      { id: 'review', label: 'Повторение', icon: App.ICONS.cards, hash: '#review', badge },
      { id: 'settings', label: 'Настройки', icon: App.ICONS.gear, hash: '#settings' },
    ];

    const header = el('header', { class: 'header' },
      el('div', { class: 'header-in' }, [
        el('button', { class: 'brand', onclick: () => nav('#home') }, [
          svgNode(UI.CROW_SVG),
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
    appEl.append(header, main, tabbar);
    window.scrollTo(0, 0);
  }

  function svgNode(svgText) {
    const d = document.createElement('div');
    d.innerHTML = svgText;
    return d.firstChild;
  }

  function crowBox(cls) {
    return el('div', { class: cls || 'crow', html: UI.CROW_SVG });
  }

  // ---------- подсчёты ---------------------------------------
  function cardsOf(folderId) {
    return folderId ? App.store.cards.filter(c => c.folder_id === folderId) : App.store.cards.slice();
  }

  function countDue(folderId) {
    if (!App.store) return 0;
    const algo = App.store.settings.algo;
    const now = Date.now();
    return cardsOf(folderId).filter(c => SRS.isDue(c, algo, now)).length;
  }

  function countNew(folderId) {
    const algo = App.store.settings.algo;
    return cardsOf(folderId).filter(c => SRS.isNew(c, algo)).length;
  }

  function newBudget() {
    const s = App.store.settings;
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

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function initials(name) {
    return (name || '?').trim().slice(0, 1).toUpperCase();
  }

  // ---------- запуск -------------------------------------------
  async function boot() {
    if (App.cloudConfigured) App.sb = new MiniSupabase(App.cfg.SUPABASE_URL, App.cfg.SUPABASE_ANON_KEY);
    const mode = localStorage.getItem('kar_mode');
    try {
      if (mode === 'local') {
        await Screens.auth.enterLocal();
      } else if (mode === 'cloud' && App.sb && await App.sb.ensureFresh()) {
        App.store = new KarStore.CloudStore(App.sb);
        await App.store.init();
        route();
      } else {
        Screens.auth.render();
      }
    } catch (e) {
      console.error(e);
      UI.toast('Ошибка запуска: ' + e.message, 'error');
      Screens.auth.render();
    }
  }

  Object.assign(App, {
    nav, route, shell, svgNode, crowBox,
    cardsOf, countDue, countNew, newBudget, spendNewBudget,
    shuffle, initials, boot,
  });
})();
