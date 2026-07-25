import { buildCardDescription, type YtCandidate } from "../../../js/lib/youtube-import.js"
import type { ExtSupabase } from "./supabase-client.js"

export interface SelectedCandidate {
  cand: YtCandidate
  back: string
}

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Минимальная запись карточки — те же поля, что buildCardRecord в приложении. */
function buildCardRow(
  data: { folder_id: string; front: string; back: string; description: string },
  userId: string
) {
  const t = Date.now()
  return {
    id: uuid(),
    created_at: t,
    updated_at: t,
    front: data.front,
    back: data.back,
    description: data.description,
    front_img: null,
    back_img: null,
    folder_id: data.folder_id,
    user_id: userId,
    sm2_ef: 2.5,
    sm2_reps: 0,
    sm2_ivl: 0,
    sm2_due: null,
    box: 0,
    box_due: null,
    fsrs_state: null,
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_due: null,
    fsrs_scheduled_days: null,
    fsrs_elapsed_days: null,
    fsrs_reps: null,
    fsrs_lapses: null,
    fsrs_learning_steps: null,
    fsrs_last_review: null
  }
}

export async function createYoutubeCardsBatch(
  sb: ExtSupabase,
  folderId: string,
  selected: SelectedCandidate[],
  videoId: string | null
): Promise<{ ok: number; failed: { front: string; message: string }[] }> {
  const uid = sb.userId()
  if (!uid) throw new Error("Нет пользователя")

  let ok = 0
  const failed: { front: string; message: string }[] = []

  for (const { cand, back } of selected) {
    const text = String(back || "").trim()
    if (!text) continue
    try {
      const row = buildCardRow(
        {
          folder_id: folderId,
          front: cand.front || "",
          back: text,
          description: buildCardDescription(cand, videoId)
        },
        uid
      )
      await sb.insert("cards", row)
      ok++
    } catch (e) {
      const err = e as Error
      failed.push({ front: cand.front || "", message: err.message || "Ошибка сохранения" })
    }
  }
  return { ok, failed }
}
