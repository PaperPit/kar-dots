import { store } from '../../core/state.js';
import { el, spinner, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import { crowBox, featherIcon, newBudget, shuffle, svgNode, trophyBox } from '../../ui/helpers.js';
import { shell, nav, offlineBanner, refreshDueBadge } from '../../ui/shell.js';
import { backBtn } from '../../ui/navigation.js';
import {
  studyModeLabel, resolveStudyMode, promptSideLabel,
  consumeSessionPromptSide, getLastPromptSide, consumeSessionCramLimit, getLastCramLimit,
} from '../../lib/study-modes.js';
import { studyModePicker } from './mode-picker.js';
import { runReviewSession } from './session.js';

let reviewSession = 0;

export async function renderReview(folderId, opts = {}) {
  const session = ++reviewSession;
  const cram = !!opts.cram && !!folderId;
  const cramPromptSide = cram
    ? (consumeSessionPromptSide() || getLastPromptSide())
    : null;

  shell('review', el('div', { class: 'review-wrap' },
    el('div', { class: 'center-pad' }, spinner(30)),
  ));

  await refreshDueBadge();
  if (session !== reviewSession) return;

  const mode = resolveStudyMode(opts.mode);
  const cramLimit = cram ? (
    opts.cramLimit > 0 ? opts.cramLimit
      : (consumeSessionCramLimit() ?? getLastCramLimit())
  ) : null;
  const algo = store.settings.algo;
  const now = Date.now();
  const budget = newBudget();
  const folder = folderId ? store.folders.find(f => f.id === folderId) : null;

  let queue;
  if (cram) {
    queue = shuffle([...(await store.getFolderCards(folderId))]);
    if (cramLimit != null && cramLimit > 0) queue = queue.slice(0, cramLimit);
  } else {
    const { due: dueCards, fresh: newCards } = await store.getReviewCards(folderId || null, algo, budget, now);
    queue = shuffle(dueCards.concat(newCards));
  }

  if (session !== reviewSession) return;

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
        onclick: () => studyModePicker({ folderId, cram: true }),
      }, 'Закрепить папку') : null,
      el('button', {
        class: 'btn primary big',
        onclick: () => nav(folderId ? '#folder/' + folderId : '#home'),
      }, folderId ? 'К папке' : 'К папкам'),
    ]));
    return;
  }

  const sessionTotal = queue.length;
  const modeLabel = studyModeLabel(mode);
  const intro = cram
    ? el('p', { class: 'review-intro review-intro-cram' }, [
      'Закрепление · ', promptSideLabel(cramPromptSide), ' · ', modeLabel, ' — ',
      String(sessionTotal), ' ',
      plural(sessionTotal, 'карточка', 'карточки', 'карточек'),
      folder ? ' из «' + folder.name + '»' : '',
    ])
    : el('p', { class: 'review-intro' }, [
      modeLabel, ' · ',
      String(sessionTotal), ' ',
      plural(sessionTotal, 'карточка', 'карточки', 'карточек'),
      folder ? ' · «' + folder.name + '»' : '',
    ]);

  const bar = el('div', null);
  const counter = el('span', { class: 'review-count' }, '');
  const speakBtn = el('button', { class: 'icon-btn', title: 'Озвучить текущую сторону' }, svgNode(ICONS.speaker));
  const editBtn = el('button', { class: 'icon-btn', title: 'Редактировать карточку' }, featherIcon());
  const stage = el('div', null);
  const wrap = el('div', { class: 'review-wrap' });
  const top = el('div', { class: 'review-top' }, [
    backBtn(folderId ? '#folder/' + folderId : '#home'),
    el('div', { class: 'progress deck-progress' }, bar),
    counter,
    speakBtn,
    editBtn,
  ]);
  wrap.append(top, stage);

  const ctx = {
    folderId,
    folder,
    mode,
    cram,
    cramPromptSide,
    algo,
    queue,
    sessionTotal,
    total: sessionTotal,
    done: 0,
    answered: 0,
    sessionFirstTry: new Set(),
    currentIsNew: false,
    gradesVisible: false,
    pendingUndo: null,
    undoToastDismiss: null,
    undoHoldUntilFlip: false,
    showNextTimer: null,
    grading: false,
    currentSwipeWrap: null,
    currentBox: null,
    currentDestroy: null,
    stats: { attempted: 0, firstTryOk: 0 },
    reshowAfterEdit: null,
    bar,
    counter,
    speakBtn,
    editBtn,
    stage,
  };

  shell('review', el('div', null, [
    offlineBanner(),
    intro,
    wrap,
  ]));

  runReviewSession(ctx);
}
