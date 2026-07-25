import { buildCardDescription, type YtCandidate } from "../../../js/lib/youtube-import.js"
import { buildCardRecord } from "../../../js/data/store-contract.js"
import type { ExtSupabase } from "./supabase-client.js"

export interface SelectedCandidate {
  cand: YtCandidate
  back: string
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
      const row = buildCardRecord(
        {
          folder_id: folderId,
          front: cand.front || "",
          back: text,
          description: buildCardDescription(cand, videoId)
        },
        { user_id: uid }
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
