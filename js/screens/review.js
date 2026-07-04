// ============================================================
// КАР-точки — экран повторения: показ карточек и оценка
// ============================================================
(function () {
  'use strict';

  const { el, stripHtml, sanitizeRich } = UI;

  function render(folderId) {
    const algo = App.store.settings.algo;
    const now = Date.now();
    const pool = App.cardsOf(folderId);

    const dueCards = App.shuffle(pool.filter(c => SRS.isDue(c, algo, now)));
    const newCards = App.shuffle(pool.filter(c => SRS.isNew(c, algo))).slice(0, App.newBudget());
    const queue = App.shuffle(dueCards.concat(newCards));

    const folder = folderId ? App.store.folders.find(f => f.id === folderId) : null;

    if (!queue.length) {
      App.shell('review', el('div', { class: 'review-done' }, [
        App.crowBox('crow'),
        el('h2', null, 'Кар! Всё повторено'),
        el('p', null, pool.length
          ? 'Сейчас нет карточек к повторению. Загляните позже — ворона напомнит точками.'
          : 'Здесь пока нет карточек — добавьте первые слова.'),
        el('button', { class: 'btn primary big', onclick: () => App.nav('#home') }, 'К папкам'),
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
      el('button', { class: 'icon-btn', onclick: () => App.nav(folderId ? '#folder/' + folderId : '#home') }, App.svgNode(App.ICONS.back)),
      el('div', { class: 'progress' }, bar),
      counter,
    ]);
    const stage = el('div', null);
    wrap.append(top, stage);
    App.shell('review', el('div', null, [
      folder ? el('p', { class: 'page-sub', style: { textAlign: 'center' } }, 'Папка: ' + folder.name) : null,
      wrap,
    ]));

    showNext(true);

    function updateBar() {
      bar.style.width = Math.round(done / total * 100) + '%';
      counter.textContent = done + ' / ' + total;
    }

    function pickSide() {
      const dir = App.store.settings.direction;
      if (dir === 'btf') return 'back';
      if (dir === 'mixed') return Math.random() < 0.5 ? 'front' : 'back';
      return 'front';
    }

    // Подбирает высоту карточки под содержимое (фото + текст),
    // но не больше 72vh — дальше появляется прокрутка внутри карточки.
    function sizeFlipCard(flipEl) {
      const faces = flipEl.querySelectorAll('.flip-face');
      let maxNeeded = 320;
      faces.forEach(face => {
        const scrollBox = face.querySelector('.flip-face-scroll');
        if (!scrollBox) return;
        const needed = scrollBox.scrollHeight + 28 * 2 + 26; // + паддинги .flip-face + метка стороны
        maxNeeded = Math.max(maxNeeded, needed);
      });
      const viewportMax = Math.max(320, Math.round(window.innerHeight * 0.72));
      flipEl.style.height = Math.min(maxNeeded, viewportMax) + 'px';
    }

    function showNext(first) {
      updateBar();
      if (!queue.length) { finish(); return; }
      const card = queue[0];
      currentIsNew = SRS.isNew(card, algo);
      const firstSide = pickSide();
      const node = cardNode(card, firstSide);
      if (!first) node.classList.add('card-swap-in');
      stage.innerHTML = '';
      stage.append(node);
    }

    // Содержимое лицевой стороны — слово/термин (+ картинка).
    function frontContent(card) {
      const plain = stripHtml(card.front);
      let wordNode = null;
      if (plain) {
        const sizeCls = plain.length > 160 ? ' long' : plain.length > 60 ? ' small' : '';
        wordNode = el('div', { class: 'word' + sizeCls });
        wordNode.innerHTML = sanitizeRich(card.front);
      }
      return [card.front_img ? el('img', { src: card.front_img, alt: '' }) : null, wordNode];
    }

    // Содержимое оборота — Определение (жирным, по центру) и,
    // если заполнено, Описание (мельче, по ширине карточки) ниже.
    function backContent(card) {
      const defPlain = stripHtml(card.back);
      const descPlain = stripHtml(card.back_desc);
      let defNode = null;
      if (defPlain) {
        const sizeCls = defPlain.length > 160 ? ' long' : defPlain.length > 60 ? ' small' : '';
        defNode = el('div', { class: 'definition' + sizeCls });
        defNode.innerHTML = sanitizeRich(card.back);
      }
      let descNode = null;
      if (descPlain) {
        descNode = el('div', { class: 'description' });
        descNode.innerHTML = sanitizeRich(card.back_desc);
      }
      return [card.back_img ? el('img', { src: card.back_img, alt: '' }) : null, defNode, descNode];
    }

    function cardNode(card, firstSide) {
      const backSide = firstSide === 'front' ? 'back' : 'front';
      let revealed = false;

      const face = (side, isBack) => {
        const content = side === 'front' ? frontContent(card) : backContent(card);
        const scroll = el('div', { class: 'flip-face-scroll' }, content);
        return el('div', { class: 'flip-face' + (isBack ? ' backside' : '') }, [
          el('div', { class: 'side-label' }, side === 'front' ? 'лицо' : 'оборот'),
          scroll,
        ]);
      };

      const flip = el('div', { class: 'flip-card' }, [face(firstSide, false), face(backSide, true)]);
      const hint = el('div', { class: 'flip-hint' }, 'Нажмите на карточку, чтобы перевернуть — можно сколько угодно раз');
      const grades = el('div', { class: 'grade-row' });
      const box = el('div', { class: 'flip-scene' }, [flip, hint, grades]);
      requestAnimationFrame(() => sizeFlipCard(flip));

      // Карточку можно переворачивать туда-обратно бесконечно —
      // это помогает сверять лицо и оборот при запоминании.
      function doFlip() {
        flip.classList.toggle('flipped');
        if (!revealed) {
          revealed = true;
          hint.style.opacity = '0';
          renderGrades();
        }
      }
      flip.addEventListener('click', doFlip);

      function renderGrades() {
        grades.innerHTML = '';
        if (algo === 'leitner') {
          const ivs = App.store.settings.leitnerIntervals;
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

      // клавиатура: пробел — перевернуть (в любую сторону, сколько угодно раз), 1–4 — оценка
      box.tabIndex = -1;
      const onKey = e => {
        if (!stage.contains(box)) { document.removeEventListener('keydown', onKey); return; }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doFlip(); }
        if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
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
        patch = SRS.leitnerNext(card, g.leitner, App.store.settings.leitnerIntervals);
        failed = !g.leitner;
      } else {
        patch = SRS.sm2Next(card, g.q);
        failed = g.q < 3;
      }
      if (currentIsNew) App.spendNewBudget();

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

      try { await App.store.updateCard(card.id, patch); }
      catch (e) { UI.toast('Не сохранилось: ' + e.message, 'error'); }

      setTimeout(() => showNext(false), 240);
    }

    function finish() {
      updateBar();
      const praise = ['Кар-кар! Отличная работа', 'Готово. Ворона гордится вами', 'Сессия завершена'];
      stage.innerHTML = '';
      stage.append(el('div', { class: 'review-done' }, [
        App.crowBox('crow'),
        el('h2', null, praise[Math.floor(Math.random() * praise.length)]),
        el('p', null, `Повторено карточек: ${total}. Следующие появятся по расписанию.`),
        el('button', { class: 'btn primary big', onclick: () => App.nav('#home') }, 'К папкам'),
      ]));
    }
  }

  Screens.review = { render };
})();
