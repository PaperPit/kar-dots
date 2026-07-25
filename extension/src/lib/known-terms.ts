import { APP_ORIGIN } from "./constants.js"
import { collectKnownTerms, isYoutubeCard } from "../../../js/lib/youtube-import.js"
import type { ExtSupabase } from "./supabase-client.js"
import type { ExtFolder } from "./folders.js"

interface MiniCard {
  front: string
  description?: string
}

async function loadPackSources(): Promise<MiniCard[][]> {
  const sources: MiniCard[][] = []
  try {
    const res = await fetch(APP_ORIGIN + "/packs/manifest.json", { cache: "no-cache" })
    if (!res.ok) return sources
    const manifest = (await res.json()) as { packs?: Array<{ file: string }> }
    for (const meta of manifest.packs || []) {
      try {
        const pr = await fetch(APP_ORIGIN + "/packs/" + meta.file, { cache: "no-cache" })
        if (!pr.ok) continue
        const data = (await pr.json()) as { cards?: MiniCard[] }
        sources.push(data.cards || [])
      } catch {
        /* pack unavailable */
      }
    }
  } catch {
    /* manifest unavailable */
  }
  return sources
}

async function folderFronts(
  sb: ExtSupabase,
  folderId: string,
  youtubeOnly: boolean
): Promise<MiniCard[]> {
  const rows = await sb.select<{ front?: string; description?: string }>(
    "cards",
    "select=front,description&folder_id=eq." + encodeURIComponent(folderId)
  )
  return rows
    .filter((c) => c.front && (!youtubeOnly || isYoutubeCard(c)))
    .map((c) => ({ front: c.front!, description: c.description }))
}

/** Known terms: vocab packs + fronts из других папок (YT-only) + все fronts целевой. */
export async function loadKnownTermsForImport(
  sb: ExtSupabase,
  folders: ExtFolder[],
  folderId: string
): Promise<Set<string>> {
  const sources = await loadPackSources()
  for (const f of folders) {
    try {
      sources.push(await folderFronts(sb, f.id, f.id !== folderId))
    } catch {
      /* folder unread */
    }
  }
  return collectKnownTerms(sources)
}
