import type { Folder, Settings } from "../../../js/data/types.js"
import { isVocabPackFolder } from "../../../js/lib/vocab-packs.js"
import { ExtSupabase } from "./supabase-client.js"

export interface ExtFolder {
  id: string
  name: string
}

/** Обычные папки пользователя (без vocab-pack). */
export async function listImportFolders(sb: ExtSupabase): Promise<ExtFolder[]> {
  const rows = await sb.select<Folder>("folders", "select=id,name,pack_id&order=created_at.asc")
  return rows
    .filter((f) => f?.id && f?.name && !isVocabPackFolder(f))
    .map((f) => ({ id: f.id, name: f.name }))
}

export async function loadUserSettings(sb: ExtSupabase): Promise<Settings | null> {
  const uid = sb.userId()
  if (!uid) return null
  const rows = await sb.select<{ data?: Settings }>("settings", "select=data&user_id=eq." + uid)
  return rows[0]?.data || null
}
