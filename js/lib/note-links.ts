/**
 * Wiki-ссылки [[Заголовок]], хештеги #tag и граф связей заметок.
 */

export interface WikiLinkRef {
  /** Цель: заголовок или id */
  target: string
  /** Подпись после |, иначе target */
  label: string
  raw: string
}

export interface NoteGraphNode {
  id: string
  title: string
  kind: "note" | "folder"
  folderId?: string | null
  tags?: string[]
}

export interface NoteGraphEdge {
  from: string
  to: string
  kind: "wiki" | "folder"
}

export interface NoteGraph {
  nodes: NoteGraphNode[]
  edges: NoteGraphEdge[]
}

const WIKI_RE = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g
/** #tag — не заголовок Markdown (# + пробел) и не ##.
 * Границу слова через lookahead: `\b` в JS смотрит только ASCII. */
const TAG_RE = /(^|[^#\p{L}\p{N}_-])#([\p{L}\p{N}_-]{2,40})(?![\p{L}\p{N}_-])/gu

export function extractWikiLinks(body: string): WikiLinkRef[] {
  const out: WikiLinkRef[] = []
  const seen = new Set<string>()
  const src = String(body ?? "")
  WIKI_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKI_RE.exec(src))) {
    const target = (m[1] || "").trim()
    if (!target) continue
    const label = ((m[2] || target).trim()) || target
    const key = target.toLowerCase() + "\0" + label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ target, label, raw: m[0] })
  }
  return out
}

export function extractHashtags(body: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const src = String(body ?? "")
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(src))) {
    const tag = (m[2] || "").toLowerCase()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}

export function normalizeNoteTitleKey(title: string): string {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

/** Индекс title → noteId (первое совпадение) + id → id. */
export function buildNoteTitleIndex(
  notes: { id: string; title?: string | null }[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const n of notes) {
    if (!n?.id) continue
    map.set(n.id.toLowerCase(), n.id)
    const key = normalizeNoteTitleKey(n.title || "")
    if (key && !map.has(key)) map.set(key, n.id)
  }
  return map
}

export function resolveWikiTarget(
  target: string,
  byTitle: Map<string, string>
): string | null {
  const t = String(target || "").trim()
  if (!t) return null
  return byTitle.get(t.toLowerCase()) || byTitle.get(normalizeNoteTitleKey(t)) || null
}

/**
 * Граф: узлы-заметки + узлы-папки (если у заметки есть folder_id),
 * рёбра wiki и «заметка → папка».
 */
export function buildNoteGraph(
  notes: {
    id: string
    title?: string | null
    body?: string | null
    folder_id?: string | null
    tags?: string[] | null
    conflict_of?: string | null
  }[],
  folders: { id: string; name?: string | null }[] = []
): NoteGraph {
  const primaries = notes.filter((n) => n && !n.conflict_of)
  const folderName = new Map(folders.map((f) => [f.id, f.name || f.id]))
  const byTitle = buildNoteTitleIndex(primaries)
  const nodes: NoteGraphNode[] = []
  const edges: NoteGraphEdge[] = []
  const nodeIds = new Set<string>()
  const edgeKeys = new Set<string>()

  const addNode = (n: NoteGraphNode) => {
    if (nodeIds.has(n.id)) return
    nodeIds.add(n.id)
    nodes.push(n)
  }
  const addEdge = (e: NoteGraphEdge) => {
    const key = e.kind + ":" + e.from + "->" + e.to
    if (edgeKeys.has(key) || e.from === e.to) return
    edgeKeys.add(key)
    edges.push(e)
  }

  for (const n of primaries) {
    addNode({
      id: n.id,
      title: n.title || "",
      kind: "note",
      folderId: n.folder_id ?? null,
      tags: Array.isArray(n.tags) ? n.tags : extractHashtags(n.body || ""),
    })
    const fid = n.folder_id
    if (fid) {
      addNode({
        id: "folder:" + fid,
        title: folderName.get(fid) || fid,
        kind: "folder",
      })
      addEdge({ from: n.id, to: "folder:" + fid, kind: "folder" })
    }
    for (const link of extractWikiLinks(n.body || "")) {
      const toId = resolveWikiTarget(link.target, byTitle)
      if (toId) addEdge({ from: n.id, to: toId, kind: "wiki" })
    }
  }

  return { nodes, edges }
}

/** Заметки, которые ссылаются на noteId через [[...]]. */
export function findBacklinks(
  noteId: string,
  noteTitle: string,
  notes: { id: string; title?: string | null; body?: string | null; conflict_of?: string | null }[]
): { id: string; title: string }[] {
  const keys = new Set(
    [noteId, normalizeNoteTitleKey(noteTitle)].filter(Boolean).map((s) => s.toLowerCase())
  )
  const out: { id: string; title: string }[] = []
  for (const n of notes) {
    if (!n || n.conflict_of || n.id === noteId) continue
    for (const link of extractWikiLinks(n.body || "")) {
      const t = normalizeNoteTitleKey(link.target)
      if (keys.has(t) || keys.has(link.target.toLowerCase())) {
        out.push({ id: n.id, title: n.title || "" })
        break
      }
    }
  }
  return out
}
