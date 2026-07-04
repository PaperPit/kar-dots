import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import { el, toast } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowBox, featherIcon, haptic, newBudget, spendNewBudget, svgNode, trophyBox, shuffle } from '../../ui/helpers.js';
import { shell, nav, offlineBanner, refreshDueBadge } from '../../ui/shell.js';
import { cardDialog } from '../card-editor/index.js';
import { createFlipCard } from './flip-card.js';
import { recordReview } from '../../lib/activity.js';

export async function renderReview(folderId) {
  // Мгновенный скелетон, пока грузятся карточки (особенно из облака).
  shell('review', el('div', { class: 'review-wrap' }, [
    el('div', { class: 'review-top' }, el('div', { class: 'progress' }, el('div', null))),
    el('div', { class: 'skeleton skeleton-flip' }),
  ]));

  await refreshDueBadge();
  const algo = store.settings.algo;
  const now = Date.now();
  const budget = newBudget();
  const { due: dueCards, fresh: newCards } = await store.getReviewCards(folderId || null, algo, budget, now);
  const queue = shuffle(dueCards.concat(newCards));
  const folder = folderId ? store.folders.find(f => f.id === folderId) : null;

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
      el('button', { class: 'btn primary big', onclick: () => nav('#home') }, 'К папкам'),
    ]));
    return;
  }

  const total = queue.length;
  const introSuffix = total === 1 ? 'точка' : total < 5 ? 'точки' : 'точек';
  const intro = el('p', { class: 'review-intro' }, [
    'Сегодня всего ', String(total), ' ',
    el('span', { class: 'kar' }, 'КАР'), introSuffix, '. Почти отпуск.',
  ]);
  let done = 0;
  let currentIsNew = false;
  const wrap = el('div', { class: 'review-wrap' });
  const bar = el('div', null);
  const counter = el('span', { class: 'review-count' }, '');
  const editBtn = el('button', { class: 'icon-btn', title: 'Редактировать карточку' }, featherIcon());
  const top = el('div', { class: 'review-top' }, [
    el('button', { class: 'icon-btn', onclick: () => nav(folderId ? '#folder/' + folderId : '#home') }, svgNode(ICONS.back)),
    el('div', { class: 'progress' }, bar),
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
    const card = queue[0];
    editBtn.style.visibility = '';
    editBtn.onclick = () => cardDialog(card.folder_id, card);
    currentIsNew = SRS.isNew(card, algo);
    const { box, grades } = createFlipCard(card, pickSide(), {
      stageContains: node => stage.contains(node),
      onFirstFlip: () => renderGrades(card, grades),
      onGradeKey: (key, gradeRow) => {
        const btns = gradeRow.querySelectorAll('.grade-btn');
        const i = Number(key) - 1;
        if (btns[i]) btns[i].click();
      },
    });
    if (!first) box.classList.add('card-swap-in');
    stage.innerHTML = '';
    stage.append(box);
  }

  function renderGrades(card, grades) {
    grades.innerHTML = '';
    const mk = (label, sub, cls, fn) => {
      const b = el('button', { class: 'grade-btn ' + cls }, [label, el('small', null, sub)]);
      b.addEventListener('click', () => {
        // защита от двойного нажатия + подтверждение выбора
        if (grades.dataset.locked) return;
        grades.dataset.locked = '1';
        b.classList.add('chosen');
        haptic(12);
        fn();
      });
      return b;
    };

    if (algo === 'leitner') {
      const ivs = store.settings.leitnerIntervals;
      grades.append(
        mk('Не помню', SRS.leitnerPreview(card, false, ivs), 'again', () => grade(card, { leitner: false })),
        mk('Помню', SRS.leitnerPreview(card, true, ivs), 'good', () => grade(card, { leitner: true })),
      );
    } else {
      grades.append(
        mk('Снова', SRS.sm2Preview(card, 0), 'again', () => grade(card, { q: 0 })),
        mk('Трудно', SRS.sm2Preview(card, 3), 'hard', () => grade(card, { q: 3 })),
        mk('Хорошо', SRS.sm2Preview(card, 4), 'good', () => grade(card, { q: 4 })),
        mk('Легко', SRS.sm2Preview(card, 5), 'easy', () => grade(card, { q: 5 })),
      );
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
    if (currentIsNew) spendNewBudget();
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
    recordReview();
    setTimeout(() => showNext(false), 240);
  }

  function finish() {
    updateBar();
    editBtn.style.visibility = 'hidden';
    stage.innerHTML = '';
    stage.append(el('div', { class: 'review-done' }, [
      trophyBox(),
      el('h2', null, 'КАР-р-р! Сегодня ты был великолепен!!!'),
      el('p', null, `Повторено карточек: ${total}. Следующие появятся по расписанию.`),
      el('button', { class: 'btn primary big', onclick: () => nav('#home') }, 'К папкам'),
    ]));
  }
}
