// ============================================================
// КАР-точки — экран настроек
// ============================================================
(function () {
  'use strict';

  const { el, toast, confirmDialog } = UI;

  function render() {
    const s = App.store.settings;

    async function save() {
      try { await App.store.saveSettings(s); }
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
        segControl(s.algo, [{ v: 'sm2', label: 'SM-2' }, { v: 'leitner', label: 'Лейтнер' }], v => { s.algo = v; save(); render(); }),
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
        await App.store.importJSON(await f.text());
        toast('Импорт завершён', 'ok');
        App.route();
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
            const blob = new Blob([App.store.exportJSON()], { type: 'application/json' });
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
    const isCloud = App.store.kind === 'cloud';
    const accGroup = el('div', { class: 'settings-group' }, [
      el('h4', null, 'Режим работы'),
      el('div', { class: 'setting-row' }, [
        el('div', { class: 'lab' }, [
          el('b', null, isCloud ? 'Облако: ' + (App.sb.session && App.sb.session.user ? App.sb.session.user.email : '') : 'Демо-режим'),
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
            if (isCloud) await App.sb.signOut();
            localStorage.removeItem('kar_mode');
            App.store = null;
            App.nav('#home');
            Screens.auth.render();
          },
        }, 'Выйти'),
      ]),
    ]);

    const about = el('p', { class: 'muted', style: { textAlign: 'center', margin: '26px 0 8px' } },
      'КАР-точки · ворона помнит всё');

    App.shell('settings', el('div', null, [
      el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Настройки')),
      algoGroup, dataGroup, accGroup, about,
    ]));
  }

  Screens.settings = { render };
})();
