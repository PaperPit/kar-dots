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
  const fragment = fragAt >= 0 ? slugifyFragment(raw.slice(fragAt + 1)) : null
  const parts = path.split("/").filter(Boolean)
  return {
    name: parts[0] || "home",
    arg: parts[1] || null,
    parts,
    fragment,
  }
}

function slugifyFragment(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

const LOADED_CSS = new Set<string>()

function loadScreenCSS(href: string): void {
  if (LOADED_CSS.has(href)) return
  LOADED_CSS.add(href)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  document.head.appendChild(link)
}

function ensureScreenCSS(name: string, arg?: string | null): void {
  if (name === "home") {
    loadScreenCSS("css/screens/home.css")
    return
  }
  if (name === "folder") {
    loadScreenCSS("css/screens/folder.css")
    loadScreenCSS("css/screens/youtube-import.css")
  }
  if (name === "review") loadScreenCSS("css/screens/review.css")
  if (name === "settings") loadScreenCSS("css/screens/settings.css")
  if (name === "stats") loadScreenCSS("css/screens/stats.css")
  if (name === "notes" && arg === "graph") loadScreenCSS("css/screens/notes.css")
  if (name === "notes" && arg === "tag") loadScreenCSS("css/screens/notes.css")
  if (name === "notes" && arg === "folder") loadScreenCSS("css/screens/notes.css")
  if (name === "notes") loadScreenCSS("css/screens/notes.css")
  if (name === "note" && arg) {
    loadScreenCSS("css/screens/note-editor.css")
    loadScreenCSS("css/screens/card-editor.css")
  }
  if (name === "box") loadScreenCSS("css/screens/folder.css")
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

     ensureScreenCSS(name, arg)

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
        cram: !!cram,
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
