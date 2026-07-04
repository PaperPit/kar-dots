// ============================================================
// КАР-точки — редактор карточки: лицо (слово) + оборот
// (Определение — жирным по центру, Описание — необязательное,
// мельче, по ширине карточки), картинки, форматирование текста.
// ============================================================
(function () {
  'use strict';

  const { el, toast, spinner, sanitizeRich } = UI;

  // Мини-редактор с форматированием (жирный + ссылки), contenteditable.
  // opts.allowBold = false скрывает кнопку "жирный" — используется для
  // поля «Определение», которое и так всегда показывается жирным.
  function richEditor(opts) {
    opts = opts || {};
    const allowBold = opts.allowBold !== false;
    const editable = el('div', {
      class: 'input rich-input', contenteditable: 'true',
      'data-placeholder': opts.placeholder || '',
    });
    editable.innerHTML = sanitizeRich(opts.value || '');

    let savedRange = null;
    function saveSelection() {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editable.contains(sel.anchorNode)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    }
    function restoreSelection() {
      if (!savedRange) return;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    function updateToolbarState() {
      if (!boldBtn) return;
      try { boldBtn.classList.toggle('active', document.queryCommandState('bold')); } catch (e) {}
    }
    editable.addEventListener('keyup', () => { saveSelection(); updateToolbarState(); });
    editable.addEventListener('mouseup', () => { saveSelection(); updateToolbarState(); });
    editable.addEventListener('blur', saveSelection);

    const boldBtn = allowBold ? el('button', {
      type: 'button', class: 'rich-btn', title: 'Жирный',
      onclick: e => {
        e.preventDefault();
        editable.focus();
        restoreSelection();
        document.execCommand('bold');
        saveSelection();
        updateToolbarState();
      },
    }, App.svgNode(App.ICONS.bold)) : null;

    const linkBtn = el('button', {
      type: 'button', class: 'rich-btn', title: 'Ссылка',
      onclick: e => {
        e.preventDefault();
        editable.focus();
        restoreSelection();
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) { toast('Сначала выделите текст для ссылки', 'error'); return; }
        const url = window.prompt('Адрес ссылки (https://...)', 'https://');
        if (!url) return;
        editable.focus();
        restoreSelection();
        document.execCommand('createLink', false, url.trim());
        saveSelection();
      },
    }, App.svgNode(App.ICONS.link));

    const toolbar = el('div', { class: 'rich-toolbar' }, [boldBtn, linkBtn]);
    const wrap = el('div', { class: 'rich-editor' }, [toolbar, editable]);

    return {
      node: wrap,
      getHTML: () => sanitizeRich(editable.innerHTML),
      isEmpty: () => !editable.textContent.trim(),
      focus: () => editable.focus(),
    };
  }

  function imgDrop(state, side) {
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
        state[side] = await App.store.uploadImage(file);
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

  function cardDialog(folderId, card) {
    const state = {
      front_img: card ? card.front_img : null,
      back_img: card ? card.back_img : null,
    };

    const frontRich = richEditor({ placeholder: 'Слово, термин или начало цитаты', value: card ? card.front : '' });
    const defRich = richEditor({ placeholder: 'Определение, перевод или суть', value: card ? card.back : '', allowBold: false });
    const descRich = richEditor({ placeholder: 'Развёрнутое описание, пример (необязательно)', value: card ? card.back_desc : '' });

    let m;
    const save = el('button', {
      class: 'btn primary',
      onclick: async () => {
        const front = frontRich.getHTML();
        const back = defRich.getHTML();
        const back_desc = descRich.getHTML();
        if (frontRich.isEmpty() && !state.front_img) { toast('Заполните лицевую сторону', 'error'); return; }
        save.disabled = true;
        try {
          const patch = { front, back, back_desc, front_img: state.front_img, back_img: state.back_img };
          if (card) await App.store.updateCard(card.id, patch);
          else await App.store.createCard(Object.assign({ folder_id: folderId }, patch));
          m.close(); App.route();
          if (!card) toast('Карточка добавлена', 'ok');
        } catch (e) { toast(e.message, 'error'); save.disabled = false; }
      },
    }, card ? 'Сохранить' : 'Добавить');

    const actions = [
      el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      save,
    ];

    m = UI.modal(el('div', null, [
      el('h3', { class: 'modal-title' }, card ? 'Карточка' : 'Новая карточка'),
      el('div', { class: 'editor-sides' }, [
        el('div', { class: 'side-box' }, [
          el('div', { class: 'side-title' }, 'Лицо'),
          frontRich.node, imgDrop(state, 'front_img'),
        ]),
        el('div', { class: 'side-box' }, [
          el('div', { class: 'side-title' }, 'Оборот'),
          el('div', { class: 'field' }, [el('label', null, 'Определение'), defRich.node]),
          el('div', { class: 'field' }, [el('label', null, 'Описание (необязательно)'), descRich.node]),
          imgDrop(state, 'back_img'),
        ]),
      ]),
      el('div', { class: 'modal-actions' }, actions),
    ]), { wide: true });
    if (!card) setTimeout(() => frontRich.focus(), 260);
  }

  Screens.editor = { open: cardDialog, richEditor };
})();
