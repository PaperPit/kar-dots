// ============================================================
// КАР-точки — алгоритмы интервального повторения
// ============================================================

import { DAY, MIN, fmtDays } from './time-units.js';
import {
  fsrsIsUntouched, fsrsNext as runFsrsNext, fsrsPreviewLabel, FsrsRating,
} from './fsrs-engine.js';

export { DAY, MIN, fmtDays };

export function sm2Next(card, quality, now) {
  now = now || Date.now();
  let ef = card.sm2_ef || 2.5;
  let reps = card.sm2_reps || 0;
  let ivl = card.sm2_ivl || 0;

  if (quality < 3) {
    reps = 0;
    ivl = 0;
    ef = Math.max(1.3, ef - 0.2);
    return { sm2_ef: ef, sm2_reps: reps, sm2_ivl: ivl, sm2_due: now + 10 * MIN };
  }

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, ef);
  reps += 1;

  if (reps === 1) ivl = quality === 5 ? 4 : 1;
  else if (reps === 2) ivl = quality === 5 ? 8 : 6;
  else ivl = Math.round(ivl * ef);

  if (quality === 3) ivl = Math.max(1, Math.round(ivl * 0.8));
  ivl = Math.min(ivl, 365);

  return { sm2_ef: ef, sm2_reps: reps, sm2_ivl: ivl, sm2_due: now + ivl * DAY };
}

export function leitnerNext(card, remembered, intervals, now) {
  now = now || Date.now();
  intervals = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16];
  let box = card.box || 0;
  if (remembered) box = Math.min(5, box + 1);
  else box = 1;
  const days = intervals[box - 1];
  return { box: box, box_due: now + days * DAY };
}

export function dueOf(card, algo) {
  if (algo === 'leitner') return card.box ? card.box_due : null;
  if (algo === 'fsrs') return fsrsIsUntouched(card) ? null : card.fsrs_due;
  return card.sm2_reps || card.sm2_due ? card.sm2_due : null;
}

export function isNew(card, algo) {
  if (algo === 'leitner') return !card.box;
  if (algo === 'fsrs') return fsrsIsUntouched(card);
  return !card.sm2_reps && !card.sm2_due;
}

export function isDue(card, algo, now) {
  now = now || Date.now();
  const d = dueOf(card, algo);
  return d !== null && d !== undefined && d <= now;
}

/** Границы календарного дня (локальное время). */
export function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

/** Карточка запланирована на повтор в интервале [from, to]. */
export function isDueBetween(card, algo, from, to) {
  const d = dueOf(card, algo);
  if (d == null) return false;
  return d >= from && d <= to;
}

/** Пора повторять или ещё не изучалась. */
export function isReviewable(card, algo, now) {
  return isDue(card, algo, now) || isNew(card, algo);
}

export function sm2Preview(card, quality, now) {
  const r = sm2Next(Object.assign({}, card), quality, now);
  if (quality < 3) return '10 мин';
  return fmtDays(r.sm2_ivl);
}

export function leitnerPreview(card, remembered, intervals) {
  const r = leitnerNext(Object.assign({}, card), remembered, intervals);
  const ivs = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16];
  return fmtDays(ivs[r.box - 1]);
}

export function fsrsPreview(card, rating, now) {
  return fsrsPreviewLabel(card, rating, now);
}

/** Поля SRS для отката оценки. */
export function srsSnapshot(card, algo) {
  if (algo === 'leitner') {
    return { box: card.box ?? 0, box_due: card.box_due ?? null };
  }
  if (algo === 'fsrs') {
    return {
      fsrs_state: card.fsrs_state ?? null,
      fsrs_stability: card.fsrs_stability ?? null,
      fsrs_difficulty: card.fsrs_difficulty ?? null,
      fsrs_due: card.fsrs_due ?? null,
      fsrs_scheduled_days: card.fsrs_scheduled_days ?? null,
      fsrs_elapsed_days: card.fsrs_elapsed_days ?? null,
      fsrs_reps: card.fsrs_reps ?? null,
      fsrs_lapses: card.fsrs_lapses ?? null,
      fsrs_learning_steps: card.fsrs_learning_steps ?? null,
      fsrs_last_review: card.fsrs_last_review ?? null,
    };
  }
  return {
    sm2_ef: card.sm2_ef ?? 2.5,
    sm2_reps: card.sm2_reps ?? 0,
    sm2_ivl: card.sm2_ivl ?? 0,
    sm2_due: card.sm2_due ?? null,
  };
}

export function fsrsNext(card, rating, now) {
  return runFsrsNext(card, rating, now);
}

export { FsrsRating };
