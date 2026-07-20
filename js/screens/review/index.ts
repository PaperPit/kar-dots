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
import { runReviewSession, type ReviewSessionContext, type ReviewMode } from './session.js';
import type { Folder } from '../../data/types.js';

let reviewSession = 0;

interface ReviewOpts {
  cram?: boolean;
  mode?: string;
  cramLimit?: number;
  review?: boolean;
  fromLesson?: boolean;
  onSaved?: unknown;
  onDeleted?: unknown;
  box_id?: string | null;
}

export async function renderReview(folderId: string | null, opts: ReviewOpts = {}) {
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

  const mode = resolveStudyMode(opts.mode ?? '') as ReviewMode;
  const cramLimit = cram ? (
    (opts.cramLimit ?? 0) > 0 ? opts.cramLimit
      : (consumeSessionCramLimit() ?? getLastCramLimit())
  ) : null;
  const algo = store.settings.algo;
  const now = Date.now();
  const budget = newBudget();
  const folder = folderId ? store.folders.find((f: Folder) => f.id === folderId) : null;

  if (algo === 'fsrs') {
    const { preloadFsrs } = await import('../../lib/srs.js');
    await preloadFsrs();
  }
  if (session !== reviewSession) return;

  let queue;
  if (cram) {
    const limit = (cramLimit ?? 0) > 0 ? cramLimit : null;
    queue = typeof store.getCramCards === 'function'
      ? await store.getCramCards(folderId, limit)
      : shuffle([...(await store.getFolderCards(folderId))]).slice(0, limit || undefined);
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
      'Закрепление · ', promptSideLabel(cramPromptSide ?? 'front'), ' · ', modeLabel, ' — ',
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

  const segs = el('div', { class: 'progress-segs' }, undefined);
  for (let i = 0; i < sessionTotal; i++) {
    segs.append(el('div', { class: 'progress-seg' + (i === 0 ? ' is-current' : '') }));
  }
  const counter = el('span', { class: 'review-count' }, '');
  const speakBtn = el('button', { class: 'icon-btn', title: 'Озвучить текущую сторону' }, svgNode(ICONS.speaker));
  const editBtn = el('button', { class: 'icon-btn', title: 'Редактировать карточку' }, featherIcon());
  const stage = el('div', null, undefined);
  const wrap = el('div', { class: 'review-wrap' }, undefined);
  const top = el('div', { class: 'review-top' }, [
    backBtn(folderId ? '#folder/' + folderId : '#home'),
    segs,
    counter,
    speakBtn,
    editBtn,
  ]);
  wrap.append(top, stage);

  const ctx: ReviewSessionContext = {
    folderId: folderId ?? undefined,
    mode,
    cram,
    cramPromptSide: cramPromptSide ?? undefined,
    algo,
    queue,
    sessionTotal,
    total: sessionTotal,
    done: 0,
    answered: 0,
    sessionFirstTry: new Set<string>(),
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
    stats: { attempted: 0, firstTryOk: 0, known: 0, failed: 0 },
    reshowAfterEdit: undefined,
    bar: segs,
    counter,
    speakBtn,
    editBtn,
    stage,
    showNext: () => {},
    trackFlipFirstTry: () => false,
    updateBar: () => {},
  };

  shell('review', el('div', null, [
    offlineBanner(),
    intro,
    wrap,
  ]), null, { hideTabbar: true });

  runReviewSession(ctx);
}
