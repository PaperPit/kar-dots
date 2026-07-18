import { fsrs, Rating, State, createEmptyCard } from '../vendor/ts-fsrs.mjs';
import { DAY, MIN, fmtDays } from './time-units.js';

let scheduler = null;

function getScheduler() {
  if (!scheduler) scheduler = fsrs();
  return scheduler;
}

/** Карточка ещё не изучалась алгоритмом FSRS. */
export function fsrsIsUntouched(card) {
  return card.fsrs_reps == null && card.fsrs_due == null && card.fsrs_state == null;
}

export function cardToFsrs(card, now = Date.now()) {
  if (fsrsIsUntouched(card)) return createEmptyCard(new Date(now));
  return {
    due: new Date(card.fsrs_due ?? now),
    stability: card.fsrs_stability ?? 0,
    difficulty: card.fsrs_difficulty ?? 0,
    elapsed_days: card.fsrs_elapsed_days ?? 0,
    scheduled_days: card.fsrs_scheduled_days ?? 0,
    learning_steps: card.fsrs_learning_steps ?? 0,
    reps: card.fsrs_reps ?? 0,
    lapses: card.fsrs_lapses ?? 0,
    state: card.fsrs_state ?? State.New,
    last_review: card.fsrs_last_review ? new Date(card.fsrs_last_review) : undefined,
  };
}

export function fsrsToPatch(fsrsCard) {
  return {
    fsrs_state: fsrsCard.state,
    fsrs_stability: fsrsCard.stability,
    fsrs_difficulty: fsrsCard.difficulty,
    fsrs_due: fsrsCard.due.getTime(),
    fsrs_scheduled_days: fsrsCard.scheduled_days,
    fsrs_elapsed_days: fsrsCard.elapsed_days,
    fsrs_reps: fsrsCard.reps,
    fsrs_lapses: fsrsCard.lapses,
    fsrs_learning_steps: fsrsCard.learning_steps,
    fsrs_last_review: fsrsCard.last_review ? fsrsCard.last_review.getTime() : null,
  };
}

export function fsrsNext(card, rating, now = Date.now()) {
  const result = getScheduler().next(cardToFsrs(card, now), new Date(now), rating);
  return fsrsToPatch(result.card);
}

export function fsrsPreviewLabel(card, rating, now = Date.now()) {
  const preview = getScheduler().repeat(cardToFsrs(card, now), new Date(now));
  return formatFsrsDue(preview[rating].card.due, now);
}

export function formatFsrsDue(dueDate, now = Date.now()) {
  const due = dueDate instanceof Date ? dueDate.getTime() : Number(dueDate);
  const ms = due - now;
  if (ms <= 0) return 'сейчас';
  if (ms < MIN) return '< 1 мин';
  if (ms < 60 * MIN) {
    const min = Math.max(1, Math.round(ms / MIN));
    return min + ' мин';
  }
  if (ms < DAY) {
    const h = Math.round(ms / (60 * MIN));
    return h + ' ч';
  }
  return fmtDays(ms / DAY);
}

export { Rating as FsrsRating, State as FsrsState };
