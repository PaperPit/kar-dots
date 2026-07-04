import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import { el, toast, spinner, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowBox, featherIcon, newBudget, spendNewBudget, svgNode, trophyBox, shuffle } from '../../ui/helpers.js';
import { shell, nav, offlineBanner, refreshDueBadge } from '../../ui/shell.js';
import { cardDialog } from '../card-editor/index.js';
import { createFlipCard } from './flip-card.js';
import { recordReview } from '../../lib/activity.js';
import { attachSwipeGrades } from '../../ui/swipe-grades.js';

export async function renderReview(folderId, opts = {}) {
  const cram = !!opts.cram && !!folderId;
  // Пока грузятся карточки (особенно из облака) — привычный спиннер ожидания,
  // чтобы переход был мгновенным и без «пустого» экрана.
  shell('review', el('div', { class: 'review-wrap' },
    el('div', { class: 'center-pad' }, spinner(30))
  ));

  await refreshDueBadge();
  const algo = store.settings.algo;
  const now = Date.now();
  const budget = newBudget();
  const folder = folderId ? store.folders.find(f => f.id === folderId) : null;

  let queue;
  if (cram) {
    queue = shuffle([...(await store.getFolderCards(folderId))]);
  } else {
    const { due: dueCards, fresh: newCards } = await store.getReviewCards(folderId || null, algo, budget, now);
    queue = shuffle(dueCards.concat(newCards));
  }

  if (!queue.length) {
    const poolCount = folderId ? await store.countCards(folderId) : await store.countCards(null);
    shell('review', el('div', { class: 'review-done' }, [
      poolCount ? trophyBox() : crowBox('crow'),
      el('h2', null, poolCount
        ? 'КАР-р-р! Сегодня ты был великолепен!!!'
        : 'Здесь пока пусто'),
      el('p', null, poolCount
        ? 'Сейчас нет карточек к повторению. Загляните позже — ворона напомнит точками.'
        : 'Добавьте первые слова — и мы начнём повторять.'),
      poolCount && folderId && !cram ? el('button', {
        class: 'btn accent big',
        onclick: () => nav('#review/' + folderId + '/cram'),
      }, 'Закрепить папку') : null,
      el('button', {
        class: 'btn primary big',
        onclick: () => nav(folderId ? '#folder/' + folderId : '#home'),
      }, folderId ? 'К папке' : 'К папкам'),
    ]));
    return;
  }

  const total = queue.length;
  const intro = cram
    ? el('p', { class: 'review-intro review-intro-cram' }, [
      'Закрепление — ',
      String(total),
      ' ',
      plural(total, 'карточка', 'карточки', 'карточек'),
      folder ? ' из «' + folder.name + '»' : '',
      '. Все карточки папки, без ожидания расписания.',
    ])
    : (() => {
      const introSuffix = total === 1 ? 'точка' : total < 5 ? 'точки' : 'точек';
      return el('p', { class: 'review-intro' }, [
        'Сегодня всего ', String(total), ' ',
        el('span', { class: 'kar' }, 'КАР'), introSuffix, '. Почти отпуск.',
      ]);
    })();
  let done = 0;
  let currentIsNew = false;
  let gradesVisible = false;
  let swipeAttached = false;
  const wrap = el('div', { class: 'review-wrap' });
  const bar = el('div', null);
  const counter = el('span', { class: 'review-count' }, '');
  const editBtn = el('button', { class: 'icon-btn', title: 'Редактировать карточку' }, featherIcon());
  const top = el('div', { class: 'review-top' }, [
    el('button', { class: 'icon-btn', onclick: () => nav(folderId ? '#folder/' + folderId : '#home') }, svgNode(ICONS.back)),
    el('div', { class: 'progress deck-progress' }, bar),
    counter,
    editBtn,
  ]);
  const stage = el('div', null);
  wrap.append(top, stage);
  shell('review', el('div', null, [
    offlineBanner(),
    folder ? el('p', { class: 'page-sub', style: { textAlign: 'center' } }, 'Папка: ' + folder.name) : null,
    intro,
    wrap,
  ]));

  showNext(true);

  function updateBar() {
    bar.style.width = Math.round(done / total * 100) + '%';
    counter.textContent = done + ' / ' + total;
  }

  function pickSide() {
    const dir = store.settings.direction;
    if (dir === 'btf') return 'back';
    if (dir === 'mixed') return Math.random() < 0.5 ? 'front' : 'back';
    return 'front';
  }

  function showNext(first) {
    updateBar();
    if (!queue.length) { finish(); return; }
    gradesVisible = false;
    swipeAttached = false;
    const card = queue[0];
    editBtn.style.visibility = '';
    editBtn.onclick = () => cardDialog(card.folder_id, card);
    currentIsNew = SRS.isNew(card, algo);
    const { box, grades } = createFlipCard(card, pickSide(), {
      stageContains: node => stage.contains(node),
      onFirstFlip: () => {
        gradesVisible = true;
        renderGrades(card, grades, box);
      },
      onGradeKey: (key, gradeRow) => {
        const btns = gradeRow.querySelectorAll('.grade-btn');
        const i = Number(key) - 1;
        if (btns[i]) btns[i].click();
      },
      onGradeDir: (dir, gradeRow) => {
        const btns = gradeRow.querySelectorAll('.grade-btn');
        const idx = { left: 0, right: 1 }[dir];
        if (idx != null && btns[idx]) btns[idx].click();
      },
    });
    if (!first) box.classList.add('card-swap-in');
    stage.innerHTML = '';
    stage.append(box);
  }

  function renderGrades(card, grades, box) {
    grades.innerHTML = '';
    const mk = (label, sub, cls, fn) =>
      el('button', { class: 'grade-btn ' + cls, onclick: fn }, [label, el('small', null, sub)]);

    const preview = algo === 'leitner'
      ? (ok => SRS.leitnerPreview(card, ok, store.settings.leitnerIntervals))
      : (q => SRS.sm2Preview(card, q));
    grades.append(
      mk('Не знаю', preview(algo === 'leitner' ? false : 0), 'again', () =>
        grade(card, algo === 'leitner' ? { leitner: false } : { q: 0 })),
      mk('Знаю', preview(algo === 'leitner' ? true : 4), 'good', () =>
        grade(card, algo === 'leitner' ? { leitner: true } : { q: 4 })),
    );

    if (!swipeAttached) {
      swipeAttached = true;
      const swipeHint = el('div', { class: 'swipe-hint' }, '← не знаю · → знаю');
      const keyboardHint = el('div', { class: 'keyboard-hint' },
        '← не знаю · → знаю · пробел — перевернуть · 1–2 — оценки');
      box.append(swipeHint, keyboardHint);
      requestAnimationFrame(() => swipeHint.classList.add('visible'));

      attachSwipeGrades(box, {
        enabled: () => gradesVisible && stage.contains(box),
        onSwipe: dir => {
          const btns = grades.querySelectorAll('.grade-btn');
          const idx = { left: 0, right: 1 }[dir];
          if (idx != null && btns[idx]) btns[idx].click();
        },
      });
    }
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
    if (currentIsNew && !cram) spendNewBudget();
    queue.shift();
    if (failed) {
      queue.splice(Math.min(3, queue.length), 0, Object.assign({}, card, patch));
    } else {
      done++;
    }
    const cur = stage.firstChild;
    if (cur) cur.classList.add('card-swap-out');
    try { await store.updateCard(card.id, patch); }
    catch (e) { toast('Не сохранилось: ' + e.message, 'error'); }
    await recordReview();
    setTimeout(() => showNext(false), 240);
  }

  function finish() {
    updateBar();
    editBtn.style.visibility = 'hidden';
    stage.innerHTML = '';
    stage.append(el('div', { class: 'review-done' }, [
      trophyBox(),
      el('h2', null, 'КАР-р-р! Сегодня ты был великолепен!!!'),
      el('p', null, cram
        ? `Закреплено карточек: ${total}. Оценки сохранены — расписание обновлено.`
        : `Повторено карточек: ${total}. Следующие появятся по расписанию.`),
      el('button', {
        class: 'btn primary big',
        onclick: () => nav(folderId ? '#folder/' + folderId : '#home'),
      }, folderId ? 'К папке' : 'К папкам'),
    ]));
  }
}
