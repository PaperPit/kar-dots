export interface FSRSCard {
  due: Date
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: Date
}

export interface FSRSScheduler {
  next(card: FSRSCard, date: Date, rating: number): { card: FSRSCard }
  repeat(card: FSRSCard, date: Date): Record<number, { card: FSRSCard }>
}

export const State: { New: number; Learning: number; Review: number; Relearning: number }
export const Rating: { Again: number; Hard: number; Good: number; Easy: number }
export function fsrs(opts?: Record<string, unknown>): FSRSScheduler
export function createEmptyCard(due?: Date): FSRSCard
