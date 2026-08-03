/**
 * Memory-state заметки: агрегация SRS-полей связанных карточек.
 *
 * Заметка сама по себе не SRS-сущность — её «состояние памяти» выводится
 * из карточек, у которых `note_id` указывает на эту заметку.
 * Используем существующие предикаты из lib/srs.js (isNew/isDue/dueOf).
 */
import { isNew, isDue, dueOf, type Algo, type SrsRow } from "./srs.js"

export type NoteMemoryState = "none" | "new" | "learning" | "rooted" | "fading"

export interface NoteMemoryInput {
  /** Карточки, связанные с заметкой (note_id). */
  cards: SrsRow[]
  algo: Algo
  now?: number
}

export interface NoteMemory {
  state: NoteMemoryState
  /** Всего связанных карточек. */
  total: number
  /** Сколько из них новые (ещё не изучались). */
  fresh: number
  /** Сколько due сейчас. */
  due: number
  /** Ближайший due timestamp (null если нечего повторять). */
  nextDueAt: number | null
  /**
   * Retrievability 0..1 — эвристика: 1 - (доля due+fresh).
   * Не является точной R из FSRS — это агрегат для UI.
   */
  retrievability: number | null
}

export function noteMemory(input: NoteMemoryInput): NoteMemory {
  const cards = input.cards || []
  const now = input.now ?? Date.now()
  const total = cards.length
  if (!total) {
    return { state: "none", total: 0, fresh: 0, due: 0, nextDueAt: null, retrievability: null }
  }
  let fresh = 0
  let due = 0
  let nextDueAt: number | null = null
  for (const c of cards) {
    if (isNew(c, input.algo)) {
      fresh++
      continue
    }
    if (isDue(c, input.algo, now)) {
      due++
    }
    const d = dueOf(c, input.algo)
    if (d != null && (nextDueAt == null || d < nextDueAt)) nextDueAt = d
  }
  const known = total - fresh
  const retrievability = known <= 0 ? 0 : Math.max(0, Math.min(1, 1 - due / total))

  let state: NoteMemoryState
  if (due > 0) state = "fading"
  else if (known === 0) state = "new"
  else if (retrievability >= 0.7) state = "rooted"
  else state = "learning"

  return { state, total, fresh, due, nextDueAt, retrievability }
}

/** Короткая метка для бейджа; локализация — через i18n на месте использования. */
export function noteMemoryLabelKey(state: NoteMemoryState): string {
  return "notes.memory.state." + state
}
