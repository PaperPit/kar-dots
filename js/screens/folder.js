// ============================================================
// КАР-точки — экран папки: список карточек
// ============================================================
(function () {
  'use strict';

  const { el, toast, confirmDialog, stripHtml } = UI;

  function render(folderId) {
    const folder = App.store.folders.find(f => f.id === folderId);
    if (!folder) { App.nav('#home'); return; }
    const cards = App.cardsOf(folderId);
    const due = App.countDue(folderId) + Math.min(App.countNew(folderId), App.newBudget());
    const algo = App.store.settings.algo;

    const head = el('div', { class: 'page-head' }, [
      el('button', { class: 'icon-btn', onclick: () => App.nav('#home') }, App.svgNode(App.ICONS.back)),
      el('div', {
        class: 'swatch',
        style: { background: folder.color, width: '30px', height: '30px', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: '800', fontSize: '13px' },
      }, App.initials(folder.name)),
      el('h2', { class: 'page-title grow' }, folder.name),
      el('button', { class: 'icon-btn', title: 'Переименовать', onclick: () => Screens.home.folderDialog(folder) }, App.svgNode(App.ICONS.pencil)),
      el('button', {
        class: 'icon-btn', title: 'Удалить папку',
        onclick: async () => {
          const yes = await confirmDialog('Удалить папку?',
            `«${folder.name}» и все её карточки (${cards.length}) будут удалены навсегда.`, 'Удалить', true);
          if (!yes) return;
          await App.store.deleteFolder(folderId);
          toast('Папка удалена');
          App.nav('#home');
        },
      }, App.svgNode(App.ICONS.trash)),
    ]);

    const actions = el('div', { class: 'row', style: { marginBottom: '18px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn primary', onclick: () => Screens.editor.open(folderId) }, [App.svgNode(App.ICONS.plus), 'Добавить карточку']),
      due > 0 ? el('button', { class: 'btn accent', onclick: () => App.nav('#review/' + folderId) }, [App.svgNode(App.ICONS.play), `Повторить (${due})`]) : null,
    ]);

    const list = el('div', { class: 'card-list' });
    cards.forEach((c, i) => {
      list.append(cardRow(c, i));
    });

    const content = [head, actions, list];
    if (!cards.length) {
      content.push(el('div', { class: 'empty' }, [
        App.crowBox('crow'),
        el('h3', null, 'В папке пусто'),
        el('p', null, 'Добавьте первое слово, термин или цитату.'),
      ]));
    }

    App.shell('home', el('div', null, content));

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
        onclick: () => Screens.editor.open(c.folder_id, c),
      }, [
        img ? el('img', { class: 'thumb', src: img, alt: '' }) : null,
        el('div', { class: 'texts' }, [
          el('div', { class: 'front' }, stripHtml(c.front) || '(картинка)'),
          el('div', { class: 'back' }, stripHtml(c.back) || ''),
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
              await App.store.deleteCard(c.id);
              App.route();
              toast('Карточка удалена');
            }, 250);
          },
        }, App.svgNode(App.ICONS.trash)),
      ]);
      return row;
    }
  }

  function textPreview(c) {
    const front = stripHtml(c.front);
    const back = stripHtml(c.back);
    const t = front + (back ? ' — ' + back : '');
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }

  Screens.folder = { render };
})();
