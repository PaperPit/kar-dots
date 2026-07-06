import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import { el, toast, toastAction } from '../../ui/ui.js';
import { spendNewBudget, refundNewBudget } from '../../ui/helpers.js';
import { recordReview, undoReview } from '../../lib/activity.js';
import { animateCardExit } from '../../ui/swipe-grades.js';
import { comboMatchBatchProgress } from '../../lib/review-progress.js';

export const UNDO_TOAST_MS = 3000;

export function dismissUndoToast(ctx, { clearPending = true } = {}) {
  if (ctx.undoToastDismiss) {
    ctx.undoToastDismiss();
    ctx.undoToastDismiss = null;
  }
  if (clearPending) ctx.pendingUndo = null;
  ctx.undoHoldUntilFlip = false;
}

export function gradePayload(algo, knowOrRating) {
  if (algo === 'leitner') return { leitner: knowOrRating };
  if (algo === 'fsrs') {
    if (typeof knowOrRating === 'number') return { fsrs: knowOrRating };
    return { fsrs: knowOrRating ? SRS.FsrsRating.Good : SRS.FsrsRating.Again };
  }
  return { q: knowOrRating ? 4 : 0 };
}

function gradeKnows(algo, g) {
  if (algo === 'leitner') return g.leitner;
  if (algo === 'fsrs') return g.fsrs >= SRS.FsrsRating.Good;
  return g.q >= 3;
}

function gradeFailed(algo, g) {
  if (algo === 'leitner') return !g.leitner;
  if (algo === 'fsrs') return g.fsrs === SRS.FsrsRating.Again;
  return g.q < 3;
}

function applyAlgoGrade(card, algo, g, now) {
  if (algo === 'leitner') return SRS.leitnerNext(card, g.leitner, store.settings.leitnerIntervals, now);
  if (algo === 'fsrs') return SRS.fsrsNext(card, g.fsrs, now);
  return SRS.sm2Next(card, g.q, now);
}

export function submitGrade(ctx, card, g, dir, { flipGrade = false } = {}) {
  if (ctx.grading) return;
  ctx.grading = true;
  if (ctx.currentBox) {
    ctx.currentBox.dataset.grading = '1';
    ctx.currentBox.classList.add('is-grading');
  }
  const know = gradeKnows(ctx.algo, g);
  const firstTryRecorded = flipGrade ? ctx.trackFlipFirstTry(card, know) : false;
  const run = () => {
    applyGrade(ctx, card, g, {
      animated: !!dir,
      flipGrade,
      firstTryRecorded,
      firstTryOk: firstTryRecorded && know,
    }).finally(() => { ctx.grading = false; });
  };
  if (dir && ctx.currentSwipeWrap && ctx.currentBox) {
    animateCardExit(ctx.currentSwipeWrap, dir, run, ctx.currentBox);
  } else run();
}

export function renderGrades(ctx, card, grades) {
  grades.innerHTML = '';
  const mk = (label, sub, cls, dir, g) => {
    const btn = el('button', {
      class: 'grade-btn ' + cls,
      onclick: () => submitGrade(ctx, card, g, dir, { flipGrade: true }),
    }, [label, el('small', null, sub)]);
    btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    btn.addEventListener('touchend', e => e.stopPropagation(), { passive: true });
    return btn;
  };

  if (ctx.algo === 'fsrs') {
    const R = SRS.FsrsRating;
    grades.append(
      mk('Снова', SRS.fsrsPreview(card, R.Again), 'again', 'left', gradePayload('fsrs', R.Again)),
      mk('Трудно', SRS.fsrsPreview(card, R.Hard), 'hard', null, gradePayload('fsrs', R.Hard)),
      mk('Хорошо', SRS.fsrsPreview(card, R.Good), 'good', 'right', gradePayload('fsrs', R.Good)),
      mk('Легко', SRS.fsrsPreview(card, R.Easy), 'easy', null, gradePayload('fsrs', R.Easy)),
    );
    if (!grades.parentElement.querySelector('.swipe-hint')) {
      grades.parentElement.append(
        el('div', { class: 'swipe-hint' }, '← снова · → хорошо'),
        el('div', { class: 'keyboard-hint' },
          '← снова · → хорошо · 1–4 — оценки · пробел — перевернуть'),
      );
      requestAnimationFrame(() => grades.parentElement.querySelector('.swipe-hint')?.classList.add('visible'));
    }
    return;
  }

  const preview = ctx.algo === 'leitner'
    ? (ok => SRS.leitnerPreview(card, ok, store.settings.leitnerIntervals))
    : (q => SRS.sm2Preview(card, q));
  grades.append(
    mk('Не знаю', preview(ctx.algo === 'leitner' ? false : 0), 'again', 'left', gradePayload(ctx.algo, false)),
    mk('Знаю', preview(ctx.algo === 'leitner' ? true : 4), 'good', 'right', gradePayload(ctx.algo, true)),
  );

  if (!grades.parentElement.querySelector('.swipe-hint')) {
    const swipeHint = el('div', { class: 'swipe-hint' }, '← не знаю · → знаю');
    const keyboardHint = el('div', { class: 'keyboard-hint' },
      '← не знаю · → знаю · пробел — перевернуть · 1–2 — оценки');
    grades.parentElement.append(swipeHint, keyboardHint);
    requestAnimationFrame(() => swipeHint.classList.add('visible'));
  }
}

export async function applyGrade(ctx, card, g, opts = {}) {
  dismissUndoToast(ctx);

  const prevSnap = SRS.srsSnapshot(card, ctx.algo);
  const spentNewBudget = ctx.currentIsNew && !ctx.cram;
  const now = Date.now();
  const patch = applyAlgoGrade(card, ctx.algo, g, now);
  const failed = gradeFailed(ctx.algo, g);
  const reinsertAt = failed ? Math.min(3, ctx.queue.length) : null;
  if (spentNewBudget) spendNewBudget();
  ctx.queue.shift();
  if (failed) {
    ctx.queue.splice(reinsertAt, 0, Object.assign({}, card, patch));
  } else if (!opts.skipProgress) {
    ctx.done++;
  }
  if (!opts.skipProgress) {
    ctx.answered++;
    ctx.updateBar();
  }
  const cur = ctx.stage.firstChild;
  if (cur && !opts.animated && !opts.skipAdvance) cur.classList.add('card-swap-out');

  if (!opts.skipAdvance) {
    if (ctx.showNextTimer) clearTimeout(ctx.showNextTimer);
    const delay = opts.animated ? 0 : 240;
    ctx.showNextTimer = setTimeout(() => {
      ctx.showNextTimer = null;
      ctx.showNext(false);
    }, delay);
  }

  try { await store.updateCard(card.id, patch); }
  catch (e) { toast('Не сохранилось: ' + e.message, 'error'); }
  await recordReview();

  ctx.pendingUndo = {
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
    ctx.pendingUndo = null;
    ctx.undoToastDismiss = null;
  } else {
    const undoToast = toastAction('Оценка сохранена', 'Отменить', () => undoLastGrade(ctx), UNDO_TOAST_MS, () => {
      ctx.pendingUndo = null;
      ctx.undoHoldUntilFlip = false;
    });
    ctx.undoToastDismiss = () => {
      undoToast.dismiss();
      ctx.pendingUndo = null;
    };
    ctx.undoHoldUntilFlip = !!opts.flipGrade;
  }
}

export async function undoLastGrade(ctx) {
  const u = ctx.pendingUndo;
  if (!u) return;
  ctx.pendingUndo = null;
  ctx.undoToastDismiss = null;

  if (u.failed) {
    const idx = ctx.queue.findIndex(c => c.id === u.card.id);
    if (idx !== -1) ctx.queue.splice(idx, 1);
  }
  ctx.queue.unshift(u.card);

  if (u.countedSuccess) ctx.done--;
  if (u.spentNewBudget) refundNewBudget();
  if (u.firstTryRecorded) {
    ctx.sessionFirstTry.delete(u.card.id);
    ctx.stats.attempted--;
    if (u.firstTryOk) ctx.stats.firstTryOk--;
  }
  if (ctx.answered > 0) ctx.answered--;

  try { await store.updateCard(u.card.id, u.prevSnap); }
  catch (e) { toast('Не удалось отменить: ' + e.message, 'error'); return; }
  await undoReview();
  ctx.updateBar();
  if (ctx.showNextTimer) { clearTimeout(ctx.showNextTimer); ctx.showNextTimer = null; }
  ctx.showNext(true);
  toast('Оценка отменена', 'ok');
}

export async function gradeMatchResults(ctx, results, { countAsOne = false } = {}) {
  if (ctx.grading) return;
  ctx.grading = true;
  if (countAsOne) {
    ctx.stats.attempted++;
    if (results.every(r => r.know)) ctx.stats.firstTryOk++;
  }
  for (let i = 0; i < results.length; i++) {
    const { card, know } = results[i];
    if (!countAsOne) {
      ctx.stats.attempted++;
      if (know) ctx.stats.firstTryOk++;
    }
    const idx = ctx.queue.findIndex(c => c.id === card.id);
    if (idx === -1) continue;
    const [item] = ctx.queue.splice(idx, 1);
    ctx.queue.unshift(item);
    ctx.currentIsNew = SRS.isNew(item, ctx.algo);
    await applyGrade(ctx, item, gradePayload(ctx.algo, know), {
      skipAdvance: true,
      quiet: i < results.length - 1,
      skipProgress: countAsOne,
    });
  }
  if (countAsOne) {
    const { answeredAdd, doneAdd } = comboMatchBatchProgress(results);
    ctx.done += doneAdd;
    ctx.answered += answeredAdd;
    ctx.updateBar();
  }
  ctx.grading = false;
  ctx.showNext(false);
}
