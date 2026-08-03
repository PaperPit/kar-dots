import { store } from "./state.js"
import { recordVisit } from "../lib/activity.js"
import { parseReviewRoute, isStudyMode } from "../lib/study-modes.js"
import { animateBootSplashOut } from "../ui/motion-lazy.js"
import { cancelNavFallback } from "../ui/navigation.js"
import { clearStaleChunkReloadFlag, reloadOnceForStaleChunk } from "../lib/stale-chunk.js"
import { t } from "../lib/i18n.js"

type HashParts = {
  name: string;
  arg: string | null;
  parts: string[];
  /** Внутренний якорь после второго `#`, напр. `#note/id#heading` → `heading`. */
  fragment: string | null;
};

export function parseHash(hash: string): HashParts {
  const raw = (hash || "#home").slice(1)
  const fragAt = raw.indexOf("#")
  const path = fragAt >= 0 ? raw.slice(0, fragAt) : raw
  const fragment = fragAt >= 0 ? raw.slice(fragAt + 1).trim() || null : null
  const parts = path.split("/").filter(Boolean)
  return {
    name: parts[0] || "home",
    arg: parts[1] || null,
    parts,
    fragment,
  }
}


export async function route(): Promise<void> {
  try {
    const { runRouteDisposer } = await import("./route-lifecycle.js")
    await runRouteDisposer()
    const { name, arg, parts, fragment } = parseHash(location.hash)
    const reviewOpts = name === "review" ? parseReviewRoute(parts) : null
    if (!store) {
      const { renderAuth } = await import("../screens/auth/index.js")
      renderAuth(undefined)
      return
    }

    const bootSplash = document.getElementById("bootSplash")
    if (bootSplash) animateBootSplashOut(bootSplash)

    await recordVisit()

    if (name === "folder" && arg) {
      const { renderFolder } = await import("../screens/folder/index.js")
      await renderFolder(arg)
    } else if (name === "box" && arg) {
      const { renderBox } = await import("../screens/box/index.js")
      await renderBox(arg)
    } else if (name === "review") {
      const opts = reviewOpts;
      if (!opts) return;
      const { folderId, noteId, cram, mode, cramLimit } = opts;
      const { renderReview } = await import("../screens/review/index.js")
      await renderReview(folderId, {
        cram: cram && !!folderId,
        mode: isStudyMode(mode) ? mode : "flip",
        cramLimit: cramLimit && cramLimit > 0 ? cramLimit : undefined,
        noteId: noteId ?? undefined,
      })
    } else if (name === "stats") {
      const { renderStats } = await import("../screens/stats/index.js")
      await renderStats()
    } else if (name === "settings") {
      const { renderSettings } = await import("../screens/settings/index.js")
      await renderSettings()
    } else if (name === "notes" && arg === "graph") {
      const { renderNotesGraph } = await import("../screens/notes/graph.js")
      await renderNotesGraph()
    } else if (name === "notes" && arg === "tag" && parts[2]) {
      const { renderNotes } = await import("../screens/notes/index.js")
      await renderNotes({ tag: parts[2] })
    } else if (name === "notes" && arg === "folder" && parts[2]) {
      const { renderNotes } = await import("../screens/notes/index.js")
      await renderNotes({ folderId: parts[2] })
    } else if (name === "notes") {
      const { renderNotes } = await import("../screens/notes/index.js")
      await renderNotes()
    } else if (name === "note" && arg) {
      const { renderNote } = await import("../screens/note/index.js")
      await renderNote(arg, { heading: fragment })
    } else {
      const { renderHome } = await import("../screens/home/index.js")
      await renderHome()
    }
    clearStaleChunkReloadFlag()
  } catch (e) {
    console.error("Route error:", e)
    if (reloadOnceForStaleChunk(e)) return
    const { toast } = await import("../ui/ui.js")
    toast(
      t("app.routeError", { message: e instanceof Error ? e.message : String(e) }),
      "error"
    )
  }
}

export function initRouter(): void {
  window.addEventListener("hashchange", () => {
    cancelNavFallback()
    route().catch(console.error)
  })
}
