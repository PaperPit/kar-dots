/** Slim SRS fields synced to cloud and stored in mirror kv `srs_meta`. */

export const SRS_FIELDS = 'id,folder_id,sm2_ef,sm2_reps,sm2_ivl,sm2_due,box,box_due,fsrs_state,fsrs_stability,fsrs_difficulty,fsrs_due,fsrs_scheduled_days,fsrs_elapsed_days,fsrs_reps,fsrs_lapses,fsrs_learning_steps,fsrs_last_review,created_at';

export function toSrsMeta(card) {
  return {
    id: card.id,
    folder_id: card.folder_id,
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
    created_at: card.created_at,
  };
}

/** Upsert slim meta in-place; returns the slim record. */
export function upsertSrsMeta(list, card) {
  const slim = toSrsMeta(card);
  const i = list.findIndex(c => c.id === card.id);
  if (i >= 0) list[i] = slim;
  else list.push(slim);
  return slim;
}

export function removeSrsMeta(list, id) {
  return list.filter(c => c.id !== id);
}

export function removeSrsMetaForFolder(list, folderId) {
  return list.filter(c => c.folder_id !== folderId);
}

export function countSrsMetaByFolder(srsMeta, folders) {
  const counts = new Map();
  for (const f of folders) {
    counts.set(f.id, srsMeta.filter(c => c.folder_id === f.id).length);
  }
  return counts;
}
