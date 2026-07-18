import { store } from '../../core/state.js';
import * as SRS from '../../lib/srs.js';
import type { Algo, SrsCard } from '../../lib/srs.js';
import { el, toast, toastAction } from '../../ui/ui.js';
import { spendNewBudget, refundNewBudget } from '../../ui/helpers.js';
import { recordReview, undoReview } from '../../lib/activity.js';
import { animateCardExit } from '../../ui/swipe-grades.js';
import { comboMatchBatchProgress } from '../../lib/review-progress.js';

export const UNDO_TOAST_MS = 3000;

export interface Grade {
  leitner?: boolean
  fsrs?: number
  q?: number
}

export interface PendingUndo {
  card: SrsCard
  prevSnap: unknown
  failed: boolean
  reinsertAt: number | null
  countedSuccess: boolean
  spentNewBudget: boolean
  firstTryRecorded: boolean
  firstTryOk: boolean
}

export interface ReviewStats {
  attempted: number
  firstTryOk: number
}

export interface GradeContext {
  algo: Algo
  answered: number
  cram: boolean
  currentBox: HTMLElement | null
  currentIsNew: boolean
  currentSwipeWrap: HTMLElement | null
  done: number
  grading: boolean
  pendingUndo: PendingUndo | null
  queue: SrsCard[]
  sessionFirstTry: Set<string>
  showNext: (advance: boolean) => void
  showNextTimer: ReturnType<typeof setTimeout> | null
  stage: HTMLElement
  stats: ReviewStats
  trackFlipFirstTry: (card: SrsCard, know: boolean) => boolean
  undoHoldUntilFlip: boolean
  undoToastDismiss: (() => void) | null
  updateBar: () => void
}

export function dismissUndoToast(ctx: GradeContext, { clearPending = true } = {}) {
  if (ctx.undoToastDismiss) {
    ctx.undoToastDismiss();
    ctx.undoToastDismiss = null;
  }
  if (clearPending) ctx.pendingUndo = null;
  ctx.undoHoldUntilFlip = false;
}

export function gradePayload(algo: Algo, knowOrRating: boolean | number): Grade {
  if (algo === 'leitner') return { leitner: knowOrRating as boolean };
  if (algo === 'fsrs') {
    if (typeof knowOrRating === 'number') return { fsrs: knowOrRating };
    return { fsrs: knowOrRating ? SRS.FsrsRating.Good : SRS.FsrsRating.Again };
  }
  return { q: knowOrRating ? 4 : 0 };
}

function gradeKnows(algo: Algo, g: Grade): boolean {
  if (algo === 'leitner') return !!g.leitner;
  if (algo === 'fsrs') return (g.fsrs ?? 0) >= SRS.FsrsRating.Good;
  return (g.q ?? 0) >= 3;
}

function gradeFailed(algo: Algo, g: Grade): boolean {
  if (algo === 'leitner') return !g.leitner;
  if (algo === 'fsrs') return g.fsrs === SRS.FsrsRating.Again;
  return (g.q ?? 0) < 3;
}

function applyAlgoGrade(card: SrsCard, algo: Algo, g: Grade, now: number) {
  if (algo === 'leitner') return SRS.leitnerNext(card, g.leitner ?? false, store.settings.leitnerIntervals, now);
  if (algo === 'fsrs') return SRS.fsrsNext(card, g.fsrs ?? SRS.FsrsRating.Again, now);
  return SRS.sm2Next(card, g.q ?? 0, now);
}

export function submitGrade(
  ctx: GradeContext,
  card: SrsCard,
  g: Grade,
  dir: 'left' | 'right' | null,
  { flipGrade = false, quiet = false } = {}
) {
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
      quiet,
    }).finally(() => { ctx.grading = false; });
  };
  if (dir && ctx.currentSwipeWrap && ctx.currentBox) {
    animateCardExit(ctx.currentSwipeWrap, dir, run, ctx.currentBox);
  } else run();
}

export function renderGrades(ctx: GradeContext, card: SrsCard, grades: HTMLElement) {
  grades.innerHTML = '';
  const mk = (
    label: string,
    sub: string,
    cls: string,
    dir: 'left' | 'right' | null,
    g: Grade
  ): HTMLButtonElement => {
    const btn = el('button', {
      class: 'grade-btn ' + cls,
      onclick: () => submitGrade(ctx, card, g, dir, { flipGrade: true }),
    }, [label, el('small', null, sub)]) as HTMLButtonElement;
    btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    btn.addEventListener('touchend', e => e.stopPropagation(), { passive: true });
    return btn;
  };

  const now = Date.now();
  if (ctx.algo === 'fsrs') {
    const R = SRS.FsrsRating;
    grades.append(
      mk('Снова', SRS.fsrsPreview(card, R.Again, now), 'again', 'left', gradePayload('fsrs', R.Again)),
      mk('Трудно', SRS.fsrsPreview(card, R.Hard, now), 'hard', null, gradePayload('fsrs', R.Hard)),
      mk('Хорошо', SRS.fsrsPreview(card, R.Good, now), 'good', 'right', gradePayload('fsrs', R.Good)),
      mk('Легко', SRS.fsrsPreview(card, R.Easy, now), 'easy', null, gradePayload('fsrs', R.Easy)),
    );
    const parent = grades.parentElement;
    if (parent && !parent.querySelector('.swipe-hint')) {
      parent.append(
        el('div', { class: 'swipe-hint' }, '← снова · → хорошо'),
        el('div', { class: 'keyboard-hint' },
          '← снова · → хорошо · 1–4 — оценки · пробел — перевернуть'),
      );
      requestAnimationFrame(() => parent.querySelector('.swipe-hint')?.classList.add('visible'));
    }
    return;
  }

  const preview = (ok: boolean | number): string =>
    ctx.algo === 'leitner'
      ? SRS.leitnerPreview(card, ok as boolean, store.settings.leitnerIntervals)
      : SRS.sm2Preview(card, ok as number, now);
  grades.append(
    mk('Не знаю', preview(ctx.algo === 'leitner' ? false : 0), 'again', 'left', gradePayload(ctx.algo, false)),
    mk('Знаю', preview(ctx.algo === 'leitner' ? true : 4), 'good', 'right', gradePayload(ctx.algo, true)),
  );

  const parent = grades.parentElement;
  if (parent && !parent.querySelector('.swipe-hint')) {
    const swipeHint = el('div', { class: 'swipe-hint' }, '← не знаю · → знаю');
    const keyboardHint = el('div', { class: 'keyboard-hint' },
      '← не знаю · → знаю · пробел — перевернуть · 1–2 — оценки');
    parent.append(swipeHint, keyboardHint);
    requestAnimationFrame(() => swipeHint.classList.add('visible'));
  }
}

export interface ApplyGradeOpts {
  animated?: boolean
  flipGrade?: boolean
  firstTryRecorded?: boolean
  firstTryOk?: boolean
  quiet?: boolean
  skipProgress?: boolean
  skipAdvance?: boolean
}

export async function applyGrade(ctx: GradeContext, card: SrsCard, g: Grade, opts: ApplyGradeOpts = {}) {
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
    ctx.queue.splice(reinsertAt ?? 0, 0, Object.assign({}, card, patch));
  } else if (!opts.skipProgress) {
    ctx.done++;
  }
  if (!opts.skipProgress) {
    ctx.answered++;
    ctx.updateBar();
  }
  const cur = ctx.stage.firstChild as HTMLElement | null;
  if (cur && !opts.animated && !opts.skipAdvance) cur.classList.add('card-swap-out');

  if (!opts.skipAdvance) {
    if (ctx.showNextTimer) clearTimeout(ctx.showNextTimer);
    const delay = opts.animated ? 0 : 240;
    ctx.showNextTimer = setTimeout(() => {
      ctx.showNextTimer = null;
      ctx.showNext(false);
    }, delay);
  }

  try { await store.updateCard(card.id ?? '', patch); }
  catch (e) { toast('Не сохранилось: ' + (e instanceof Error ? e.message : String(e)), 'error'); }
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
  const showUndoToast = opts.flipGrade && !opts.quiet;
  if (!showUndoToast) {
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
    ctx.undoHoldUntilFlip = true;
  }
}

export async function undoLastGrade(ctx: GradeContext) {
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
    ctx.sessionFirstTry.delete(u.card.id ?? '');
    ctx.stats.attempted--;
    if (u.firstTryOk) ctx.stats.firstTryOk--;
  }
  if (ctx.answered > 0) ctx.answered--;

  try { await store.updateCard(u.card.id ?? '', u.prevSnap); }
  catch (e) { toast('Не удалось отменить: ' + (e instanceof Error ? e.message : String(e)), 'error'); return; }
  await undoReview();
  ctx.updateBar();
  if (ctx.showNextTimer) { clearTimeout(ctx.showNextTimer); ctx.showNextTimer = null; }
  ctx.showNext(true);
  toast('Оценка отменена', 'ok');
}

export interface MatchResult {
  card: SrsCard
  know: boolean
}

export async function gradeMatchResults(
  ctx: GradeContext,
  results: MatchResult[],
  { countAsOne = false } = {}
) {
  if (ctx.grading) return;
  ctx.grading = true;
  if (countAsOne) {
    ctx.stats.attempted++;
    if (results.every(r => r.know)) ctx.stats.firstTryOk++;
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r) continue;
    const { card, know } = r;
    if (!countAsOne) {
      ctx.stats.attempted++;
      if (know) ctx.stats.firstTryOk++;
    }
    const idx = ctx.queue.findIndex(c => c.id === card.id);
    if (idx === -1) continue;
    const [item] = ctx.queue.splice(idx, 1);
    if (!item) continue;
    ctx.queue.unshift(item);
    ctx.currentIsNew = SRS.isNew(item, ctx.algo);
    await applyGrade(ctx, item, gradePayload(ctx.algo, know), {
      skipAdvance: true,
      quiet: true,
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
