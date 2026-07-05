import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import { el, toast, toastAction, spinner, plural } from '../../ui/ui.js';
import { ICONS } from '../../ui/constants.js';
import {
  crowBox, featherIcon, newBudget, spendNewBudget, refundNewBudget,
  speakCardSide, svgNode, trophyBox, lessonRewardBox, shuffle,
} from '../../ui/helpers.js';
import { computeLessonStars, lessonFinishTitle } from '../../lib/lesson-stars.js';
import { playLessonCompleteFromStore } from '../../lib/sounds.js';
import { shell, nav, offlineBanner, refreshDueBadge } from '../../ui/shell.js';
import { cardDialog } from '../card-editor/index.js';
import { recordReview, undoReview } from '../../lib/activity.js';
import { attachSwipeGrades, animateCardExit } from '../../ui/swipe-grades.js';
import { cardHasCheckableAnswer } from '../../lib/answer-check.js';
import {
  studyModeLabel, resolveStudyMode, promptSideLabel,
  consumeSessionPromptSide, getLastPromptSide, consumeSessionCramLimit, getLastCramLimit,
} from '../../lib/study-modes.js';
import { speechRecognitionSupported } from '../../lib/speech-input.js';
import { studyModePicker } from './mode-picker.js';
import { createFlipModeCard } from './modes/flip.js';
import { createTypeModeCard } from './modes/type.js';
import { createVoiceModeCard } from './modes/voice.js';
import { createMatchRound, pickMatchBatch, MIN_BATCH, BATCH_SIZE, COMBO_MATCH_BATCH } from './modes/match.js';
import { comboMatchBatchProgress, finishProgressAnswered } from '../../lib/review-progress.js';

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

  // Лимит: сначала из URL (#review/…/cram/20/…), затем storage.
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
  let total = sessionTotal;
  const modeLabel = studyModeLabel(mode);
  const intro = cram
    ? el('p', { class: 'review-intro review-intro-cram' }, [
      'Закрепление · ', promptSideLabel(cramPromptSide), ' · ', modeLabel, ' — ',
      String(total), ' ',
      plural(total, 'карточка', 'карточки', 'карточек'),
      folder ? ' из «' + folder.name + '»' : '',
    ])
    : el('p', { class: 'review-intro' }, [
      modeLabel, ' · ',
      String(total), ' ',
      plural(total, 'карточка', 'карточки', 'карточек'),
      folder ? ' · «' + folder.name + '»' : '',
    ]);

  let done = 0;
  let answered = 0;
  const sessionFirstTry = new Set();
  let currentIsNew = false;
  let gradesVisible = false;
  let pendingUndo = null;
  let undoToastDismiss = null;
  let showNextTimer = null;
  let grading = false;
  let currentSwipeWrap = null;
  let currentBox = null;
  let currentDestroy = null;
  const stats = { attempted: 0, firstTryOk: 0 };
  let reshowAfterEdit = null;

  function syncCardInQueue(id, patch) {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].id === id) Object.assign(queue[i], patch);
    }
  }

  function removeCardFromSession(cardId) {
    if (undoToastDismiss) { undoToastDismiss(); undoToastDismiss = null; }
    pendingUndo = null;
    if (showNextTimer) { clearTimeout(showNextTimer); showNextTimer = null; }

    const idx = queue.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const wasCurrent = idx === 0;
    queue.splice(idx, 1);
    total = Math.max(done, total - 1);

    clearStage();
    updateBar();
    toast('Карточка удалена', 'ok');
    if (!queue.length) finish();
    else if (wasCurrent) showNext(false);
  }

  function reviewCardDialogOpts(card) {
    return {
      review: true,
      onSaved: patch => {
        syncCardInQueue(card.id, patch);
        toast('Карточка сохранена', 'ok');
        reshowAfterEdit?.();
      },
      onDeleted: () => removeCardFromSession(card.id),
    };
  }

  const wrap = el('div', { class: 'review-wrap' });
  const bar = el('div', null);
  const counter = el('span', { class: 'review-count' }, '');
  const speakBtn = el('button', { class: 'icon-btn', title: 'Озвучить текущую сторону' }, svgNode(ICONS.speaker));
  const editBtn = el('button', { class: 'icon-btn', title: 'Редактировать карточку' }, featherIcon());
  const top = el('div', { class: 'review-top' }, [
    el('button', { class: 'icon-btn', onclick: () => nav(folderId ? '#folder/' + folderId : '#home') }, svgNode(ICONS.back)),
    el('div', { class: 'progress deck-progress' }, bar),
    counter,
    speakBtn,
    editBtn,
  ]);
  const stage = el('div', null);
  wrap.append(top, stage);
  shell('review', el('div', null, [
    offlineBanner(),
    intro,
    wrap,
  ]));

  showNext(true);

  function updateBar() {
    const shown = Math.min(answered, sessionTotal);
    bar.style.width = Math.round(shown / sessionTotal * 100) + '%';
    counter.textContent = shown + ' / ' + sessionTotal;
  }

  function trackFlipFirstTry(card, know) {
    if (sessionFirstTry.has(card.id)) return false;
    sessionFirstTry.add(card.id);
    stats.attempted++;
    if (know) stats.firstTryOk++;
    return true;
  }

  function pickSide() {
    if (cramPromptSide) return cramPromptSide;
    const dir = store.settings.direction;
    if (dir === 'btf') return 'back';
    if (dir === 'mixed') return Math.random() < 0.5 ? 'front' : 'back';
    return 'front';
  }

  function gradePayload(know) {
    return algo === 'leitner' ? { leitner: know } : { q: know ? 4 : 0 };
  }

  function clearStage() {
    if (currentDestroy) { currentDestroy(); currentDestroy = null; }
    currentSwipeWrap = null;
    currentBox = null;
  }

  function skipUncheckableFromHead() {
    const side = pickSide();
    while (queue.length && !cardHasCheckableAnswer(queue[0], side)) {
      toast(side === 'front' ? 'Нет перевода для проверки — пропуск' : 'Нет термина для проверки — пропуск', 'error');
      queue.shift();
    }
  }

  function submitGrade(card, g, dir, { flipGrade = false } = {}) {
    if (grading) return;
    grading = true;
    const know = algo === 'leitner' ? g.leitner : g.q >= 3;
    const firstTryRecorded = flipGrade ? trackFlipFirstTry(card, know) : false;
    const run = () => {
      grade(card, g, {
        animated: !!dir,
        firstTryRecorded,
        firstTryOk: firstTryRecorded && know,
      }).finally(() => { grading = false; });
    };
    if (dir && currentSwipeWrap && currentBox) {
      animateCardExit(currentSwipeWrap, dir, run, currentBox);
    } else run();
  }

  function mountStage(box, first, { destroy } = {}) {
    clearStage();
    currentBox = box;
    currentDestroy = destroy || null;
    if (!first) box.classList.add('card-swap-in');
    stage.innerHTML = '';
    stage.append(box);
  }

  function canComboMatchRound() {
    const side = pickSide();
    const { batch } = pickMatchBatch(queue, COMBO_MATCH_BATCH, COMBO_MATCH_BATCH, side);
    return batch.length >= COMBO_MATCH_BATCH;
  }

  function pickComboSubMode() {
    if (canComboMatchRound() && Math.random() < 0.33) return 'match';
    if (speechRecognitionSupported()) return Math.random() < 0.5 ? 'type' : 'voice';
    return 'type';
  }

  function recordFirstTryResult({ success, firstTry }) {
    stats.attempted++;
    if (success && firstTry) stats.firstTryOk++;
  }

  function showNext(first) {
    updateBar();
    if (!queue.length) { finish(); return; }

    if (mode === 'match') {
      showMatchRound(first);
      return;
    }

    skipUncheckableFromHead();
    if (!queue.length) { finish(); return; }

    if (mode === 'combo') {
      const sub = pickComboSubMode();
      if (sub === 'match') {
        showMatchRound(first, { batchSize: COMBO_MATCH_BATCH, countAsOne: true });
        return;
      }
      showStudyCard(first, sub);
      return;
    }

    showStudyCard(first);
  }

  function resolveActiveMode(forceMode) {
    if (forceMode) return forceMode;
    if (mode === 'combo') return pickComboSubMode();
    return mode;
  }

  function showStudyCard(first, forceMode) {
    gradesVisible = false;
    const card = queue[0];
    const activeMode = resolveActiveMode(forceMode);
    if (activeMode === 'match') {
      showMatchRound(first, { batchSize: COMBO_MATCH_BATCH, countAsOne: true });
      return;
    }
    reshowAfterEdit = () => showStudyCard(true, mode === 'combo' ? activeMode : forceMode);
    editBtn.style.visibility = '';
    editBtn.onclick = () => cardDialog(card.folder_id, card, reviewCardDialogOpts(card));
    currentIsNew = SRS.isNew(card, algo);

    const promptSide = pickSide();
    const onSuccess = ({ firstTry } = {}) => {
      recordFirstTryResult({ success: true, firstTry: !!firstTry });
      submitGrade(card, gradePayload(true));
    };
    const onFail = () => {
      recordFirstTryResult({ success: false, firstTry: false });
      submitGrade(card, gradePayload(false));
    };

    let widget;
    if (activeMode === 'type') {
      speakBtn.style.display = store.settings.tts !== false ? '' : 'none';
      speakBtn.onclick = () => {
        if (!speakCardSide(card, promptSide)) toast('Нет текста для озвучки', 'error');
      };
      widget = createTypeModeCard(card, { promptSide, onSuccess, onFail, getSettings: () => store.settings });
    } else if (activeMode === 'voice') {
      speakBtn.style.display = store.settings.tts !== false ? '' : 'none';
      speakBtn.onclick = () => {
        if (!speakCardSide(card, promptSide)) toast('Нет текста для озвучки', 'error');
      };
      widget = createVoiceModeCard(card, { promptSide, onSuccess, onFail, getSettings: () => store.settings });
    } else {
      widget = showFlipCard(card, first, promptSide);
      return;
    }

    mountStage(widget.box, first, { destroy: widget.destroy });
  }

  function showFlipCard(card, first, promptSide) {
    speakBtn.style.display = store.settings.tts !== false ? '' : 'none';
    const side = promptSide || pickSide();
    reshowAfterEdit = () => showStudyCard(true, 'flip');
    editBtn.style.visibility = '';
    editBtn.onclick = () => cardDialog(card.folder_id, card, reviewCardDialogOpts(card));
    const { box, swipeWrap, grades, getVisibleSide } = createFlipModeCard(card, {
      promptSide: side,
      stageContains: node => stage.contains(node),
      onFirstFlip: () => {
        gradesVisible = true;
        renderGrades(card, grades);
      },
      onFlip: flipSide => {
        if (store.settings.tts !== false && store.settings.ttsAuto) speakCardSide(card, flipSide);
      },
      onGradeKey: (key, gradeRow) => {
        const btns = gradeRow.querySelectorAll('.grade-btn');
        const i = Number(key) - 1;
        if (btns[i]) btns[i].click();
      },
      onGradeDir: dir => submitGrade(card, gradePayload(dir === 'right'), dir, { flipGrade: true }),
    });
    currentSwipeWrap = swipeWrap;
    speakBtn.onclick = () => {
      if (!speakCardSide(card, getVisibleSide())) toast('Нет текста для озвучки', 'error');
    };
    attachSwipeGrades(box, {
      cardEl: swipeWrap,
      enabled: () => gradesVisible && stage.contains(box) && !grading,
      onSwipe: dir => submitGrade(card, gradePayload(dir === 'right'), dir, { flipGrade: true }),
    });
    mountStage(box, first);
  }

  function showMatchRound(first, { batchSize = BATCH_SIZE, countAsOne = false } = {}) {
    skipUncheckableFromHead();
    if (!queue.length) { finish(); return; }

    const minBatch = countAsOne ? batchSize : MIN_BATCH;
    const { batch, single } = pickMatchBatch(queue, minBatch, batchSize, pickSide());
    if (single && batch.length === 1) {
      showStudyCard(first, 'type');
      return;
    }
    if (batch.length < minBatch) {
      if (queue.length) {
        if (mode === 'combo') {
          showStudyCard(first, speechRecognitionSupported() && Math.random() < 0.5 ? 'voice' : 'type');
        } else showStudyCard(first, 'type');
      } else finish();
      return;
    }

    editBtn.style.visibility = 'hidden';
    speakBtn.style.display = 'none';

    const widget = createMatchRound(batch, {
      promptSide: pickSide(),
      onRoundComplete: results => gradeMatchResults(results, { countAsOne }),
    });
    mountStage(widget.box, first, { destroy: widget.destroy });
  }

  async function gradeMatchResults(results, { countAsOne = false } = {}) {
    if (grading) return;
    grading = true;
    if (countAsOne) {
      stats.attempted++;
      if (results.every(r => r.know)) stats.firstTryOk++;
    }
    for (let i = 0; i < results.length; i++) {
      const { card, know } = results[i];
      if (!countAsOne) {
        stats.attempted++;
        if (know) stats.firstTryOk++;
      }
      const idx = queue.findIndex(c => c.id === card.id);
      if (idx === -1) continue;
      const [item] = queue.splice(idx, 1);
      queue.unshift(item);
      currentIsNew = SRS.isNew(item, algo);
      await grade(item, gradePayload(know), {
        skipAdvance: true,
        quiet: i < results.length - 1,
        skipProgress: countAsOne,
      });
    }
    if (countAsOne) {
      const { answeredAdd, doneAdd } = comboMatchBatchProgress(results);
      done += doneAdd;
      answered += answeredAdd;
      updateBar();
    }
    grading = false;
    showNext(false);
  }

  function renderGrades(card, grades) {
    grades.innerHTML = '';
    const mk = (label, sub, cls, dir, g) =>
      el('button', {
        class: 'grade-btn ' + cls,
        onclick: () => submitGrade(card, g, dir, { flipGrade: true }),
      }, [label, el('small', null, sub)]);

    const preview = algo === 'leitner'
      ? (ok => SRS.leitnerPreview(card, ok, store.settings.leitnerIntervals))
      : (q => SRS.sm2Preview(card, q));
    grades.append(
      mk('Не знаю', preview(algo === 'leitner' ? false : 0), 'again', 'left', gradePayload(false)),
      mk('Знаю', preview(algo === 'leitner' ? true : 4), 'good', 'right', gradePayload(true)),
    );

    if (!grades.parentElement.querySelector('.swipe-hint')) {
      const swipeHint = el('div', { class: 'swipe-hint' }, '← не знаю · → знаю');
      const keyboardHint = el('div', { class: 'keyboard-hint' },
        '← не знаю · → знаю · пробел — перевернуть · 1–2 — оценки');
      grades.parentElement.append(swipeHint, keyboardHint);
      requestAnimationFrame(() => swipeHint.classList.add('visible'));
    }
  }

  async function grade(card, g, opts = {}) {
    if (undoToastDismiss) { undoToastDismiss(); undoToastDismiss = null; }
    pendingUndo = null;

    const prevSnap = SRS.srsSnapshot(card, algo);
    const spentNewBudget = currentIsNew && !cram;
    let patch, failed;
    if (algo === 'leitner') {
      patch = SRS.leitnerNext(card, g.leitner, store.settings.leitnerIntervals);
      failed = !g.leitner;
    } else {
      patch = SRS.sm2Next(card, g.q);
      failed = g.q < 3;
    }
    const reinsertAt = failed ? Math.min(3, queue.length) : null;
    if (spentNewBudget) spendNewBudget();
    queue.shift();
    if (failed) {
      queue.splice(reinsertAt, 0, Object.assign({}, card, patch));
    } else if (!opts.skipProgress) {
      done++;
    }
    if (!opts.skipProgress) {
      answered++;
      updateBar();
    }
    const cur = stage.firstChild;
    if (cur && !opts.animated && !opts.skipAdvance) cur.classList.add('card-swap-out');
    try { await store.updateCard(card.id, patch); }
    catch (e) { toast('Не сохранилось: ' + e.message, 'error'); }
    await recordReview();

    pendingUndo = {
      card: Object.assign({}, card),
      prevSnap,
      failed,
      reinsertAt,
      countedSuccess: !failed,
      spentNewBudget,
      firstTryRecorded: !!opts.firstTryRecorded,
      firstTryOk: !!opts.firstTryOk,
    };
    if (opts.quiet) {
      pendingUndo = null;
      undoToastDismiss = null;
    } else {
      const undoToast = toastAction('Оценка сохранена', 'Отменить', () => undoLastGrade(), 4500, () => {
        pendingUndo = null;
      });
      undoToastDismiss = () => {
        undoToast.dismiss();
        pendingUndo = null;
      };
    }

    if (opts.skipAdvance) return;

    const delay = opts.animated ? 80 : 240;
    if (showNextTimer) clearTimeout(showNextTimer);
    showNextTimer = setTimeout(() => {
      showNextTimer = null;
      showNext(false);
    }, delay);
  }

  async function undoLastGrade() {
    const u = pendingUndo;
    if (!u) return;
    pendingUndo = null;
    undoToastDismiss = null;

    if (u.failed) {
      const idx = queue.findIndex(c => c.id === u.card.id);
      if (idx !== -1) queue.splice(idx, 1);
    }
    queue.unshift(u.card);

    if (u.countedSuccess) done--;
    if (u.spentNewBudget) refundNewBudget();
    if (u.firstTryRecorded) {
      sessionFirstTry.delete(u.card.id);
      stats.attempted--;
      if (u.firstTryOk) stats.firstTryOk--;
    }
    if (answered > 0) answered--;

    try { await store.updateCard(u.card.id, u.prevSnap); }
    catch (e) { toast('Не удалось отменить: ' + e.message, 'error'); return; }
    await undoReview();
    updateBar();
    if (showNextTimer) { clearTimeout(showNextTimer); showNextTimer = null; }
    showNext(true);
    toast('Оценка отменена', 'ok');
  }

  function finishSummaryLine() {
    if (mode === 'match') {
      return `Пары с первой попытки: ${stats.firstTryOk} из ${sessionTotal}`;
    }
    if (mode === 'flip' || mode === 'type' || mode === 'voice' || mode === 'combo') {
      return `Верно с первой попытки: ${stats.firstTryOk} из ${sessionTotal}`;
    }
    return null;
  }

  function finish() {
    clearStage();
    answered = finishProgressAnswered(sessionTotal);
    updateBar();
    editBtn.style.visibility = 'hidden';
    speakBtn.style.display = 'none';
    stage.innerHTML = '';
    const summaryLine = finishSummaryLine();
    const stars = computeLessonStars({ mode, stats, sessionCards: sessionTotal });
    const statTiles = [
      summaryLine ? el('div', { class: 'stat-tile' }, [
        el('div', { class: 'stat-tile-val' }, `${stats.firstTryOk}/${sessionTotal}`),
        el('div', { class: 'stat-tile-lab' }, 'с первой попытки'),
      ]) : null,
      el('div', { class: 'stat-tile' }, [
        el('div', { class: 'stat-tile-val' }, String(sessionTotal)),
        el('div', { class: 'stat-tile-lab' }, cram ? 'закреплено' : 'повторено'),
      ]),
    ].filter(Boolean);
    stage.append(el('div', { class: 'review-done' }, [
      lessonRewardBox(stars),
      el('h2', null, lessonFinishTitle(stars)),
      el('div', { class: 'stats-grid' }, statTiles),
      cram ? null : el('p', { class: 'muted' }, 'Следующие появятся по расписанию.'),
      el('button', {
        class: 'btn primary big',
        onclick: () => nav(folderId ? '#folder/' + folderId : '#home'),
      }, folderId ? 'К папке' : 'К папкам'),
    ]));
    playLessonCompleteFromStore(stars);
  }
}
