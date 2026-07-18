import type { SrsRow } from "../lib/srs.js"

interface SrsSource {
  id?: string;
  folder_id?: string;
  sm2_ef?: number | null;
  sm2_reps?: number | null;
  sm2_ivl?: number | null;
  sm2_due?: number | null;
  box?: number | null;
  box_due?: number | null;
  fsrs_state?: unknown;
  fsrs_stability?: number | null;
  fsrs_difficulty?: number | null;
  fsrs_due?: number | null;
  fsrs_scheduled_days?: number | null;
  fsrs_elapsed_days?: number | null;
  fsrs_reps?: number | null;
  fsrs_lapses?: number | null;
  fsrs_learning_steps?: unknown;
  fsrs_last_review?: number | null;
  created_at?: number | null;
}

/** Slim SRS fields synced to cloud and stored in mirror kv `srs_meta`. */

export const SRS_FIELDS =
  "id,folder_id,sm2_ef,sm2_reps,sm2_ivl,sm2_due,box,box_due,fsrs_state,fsrs_stability,fsrs_difficulty,fsrs_due,fsrs_scheduled_days,fsrs_elapsed_days,fsrs_reps,fsrs_lapses,fsrs_learning_steps,fsrs_last_review,created_at"

/** Content + SRS — enough for an online review session (no select=*). */
export const REVIEW_CARD_FIELDS = SRS_FIELDS + ",front,back,description,front_img,back_img"

export interface SrsMeta extends SrsRow {
  id: string;
  folder_id: string;
  sm2_ef?: number | null;
  sm2_reps?: number | null;
  sm2_ivl?: number | null;
  sm2_due?: number | null;
  box?: number | null;
  box_due?: number | null;
  fsrs_state?: unknown;
  fsrs_stability?: number | null;
  fsrs_difficulty?: number | null;
  fsrs_due?: number | null;
  fsrs_scheduled_days?: number | null;
  fsrs_elapsed_days?: number | null;
  fsrs_reps?: number | null;
  fsrs_lapses?: number | null;
  fsrs_learning_steps?: unknown;
  fsrs_last_review?: number | null;
  created_at?: number | null;
}

export function toSrsMeta(card: SrsSource): SrsMeta {
  return {
    id: card.id ?? "",
    folder_id: card.folder_id ?? "",
    sm2_ef: card.sm2_ef,
    sm2_reps: card.sm2_reps,
    sm2_ivl: card.sm2_ivl,
    sm2_due: card.sm2_due,
    box: card.box,
    box_due: card.box_due,
    fsrs_state: card.fsrs_state,
    fsrs_stability: card.fsrs_stability,
    fsrs_difficulty: card.fsrs_difficulty,
    fsrs_due: card.fsrs_due,
    fsrs_scheduled_days: card.fsrs_scheduled_days,
    fsrs_elapsed_days: card.fsrs_elapsed_days,
    fsrs_reps: card.fsrs_reps,
    fsrs_lapses: card.fsrs_lapses,
    fsrs_learning_steps: card.fsrs_learning_steps,
    fsrs_last_review: card.fsrs_last_review,
    created_at: card.created_at
  }
}

/** Upsert slim meta in-place; returns the slim record. */
export function upsertSrsMeta(list: SrsMeta[], card: SrsSource): SrsMeta {
  const slim = toSrsMeta(card)
  const i = list.findIndex((c) => c.id === card.id)
  if (i >= 0) list[i] = slim
  else list.push(slim)
  return slim
}

export function removeSrsMeta(list: SrsMeta[], id: string): SrsMeta[] {
  return list.filter((c) => c.id !== id)
}

export function removeSrsMetaForFolder(list: SrsMeta[], folderId: string): SrsMeta[] {
  return list.filter((c) => c.folder_id !== folderId)
}

export function countSrsMetaByFolder(srsMeta: SrsMeta[], folders: { id: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const f of folders) {
    counts.set(f.id, srsMeta.filter((c) => c.folder_id === f.id).length)
  }
  return counts
}
