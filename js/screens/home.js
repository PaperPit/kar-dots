// ============================================================
// КАР-точки — главный экран (сетка папок) и диалог папки
// ============================================================
(function () {
  'use strict';

  const { el, toast, plural } = UI;

  function render() {
    const dueAll = App.countDue(null);
    const newAll = Math.min(App.countNew(null), App.newBudget());
    const totalToStudy = dueAll + newAll;

    const hero = el('div', { class: 'review-hero' }, [
      App.crowBox('crow'),
      el('div', { class: 'grow' }, [
        el('h2', null, totalToStudy > 0
          ? `К повторению: ${totalToStudy} ${plural(totalToStudy, 'карточка', 'карточки', 'карточек')}`
          : 'Всё повторено. Кар!'),
        el('p', null, totalToStudy > 0
          ? 'Ворона ждёт — пара минут, и память скажет спасибо.'
          : 'Добавьте новые слова или загляните позже.'),
      ]),
      totalToStudy > 0
        ? el('button', { class: 'btn accent big', onclick: () => App.nav('#review') }, [App.svgNode(App.ICONS.play), 'Повторить'])
        : null,
    ]);

    const grid = el('div', { class: 'folder-grid' });
    App.store.folders.forEach((f, i) => {
      const n = App.cardsOf(f.id).length;
      const due = App.countDue(f.id) + Math.min(App.countNew(f.id), App.newBudget());
      const card = el('div', {
        class: 'folder-card', style: { animationDelay: (i * 40) + 'ms' },
        onclick: () => App.nav('#folder/' + f.id),
      }, [
        el('div', { class: 'swatch', style: { background: f.color } }, App.initials(f.name)),
        el('h3', null, f.name),
        el('div', { class: 'meta' }, n + ' ' + plural(n, 'карточка', 'карточки', 'карточек')),
        due > 0 ? el('div', { class: 'due-chip' }, due + ' к повторению') : null,
      ]);
      grid.append(card);
    });
    grid.append(el('button', {
      class: 'add-tile', style: { animationDelay: (App.store.folders.length * 40) + 'ms' },
      onclick: () => folderDialog(),
    }, '+ Новая папка'));

    const content = [hero, el('div', { class: 'page-head' }, el('h2', { class: 'page-title' }, 'Папки')), grid];

    if (!App.store.folders.length) {
      content.push(el('div', { class: 'empty' }, [
        App.crowBox('crow'),
        el('h3', null, 'Пока пусто'),
        el('p', null, 'Создайте папку — например, «Английский» или «Философия».'),
      ]));
    }

    App.shell('home', el('div', null, content));
  }

  // диалог создания/редактирования папки
  function folderDialog(folder) {
    let color = folder ? folder.color : App.FOLDER_COLORS[Math.floor(Math.random() * App.FOLDER_COLORS.length)];
    const name = el('input', { class: 'input', value: folder ? folder.name : '', placeholder: 'Например, Английский' });
    const dots = el('div', { class: 'color-row' }, App.FOLDER_COLORS.map(c =>
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
          if (folder) await App.store.updateFolder(folder.id, { name: nm, color });
          else await App.store.createFolder({ name: nm, color });
          m.close(); App.route();
        } catch (e) { toast(e.message, 'error'); save.disabled = false; }
      },
    }, folder ? 'Сохранить' : 'Создать');

    m = UI.modal(el('div', null, [
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

  Screens.home = { render, folderDialog };
})();
