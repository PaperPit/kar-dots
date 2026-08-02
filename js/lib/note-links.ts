/**
 * Wiki-ссылки [[Заголовок]], хештеги #tag и граф связей заметок.
 */

export interface WikiLinkRef {
  /** Цель: заголовок или id, без #anchor */
  target: string
  /** Якорь после #, если указан */
  anchor?: string
  /** Подпись после |, иначе target или target#anchor */
  label: string
  raw: string
}

export interface EmbedRef {
  /** Цель: заголовок или id, без #anchor */
  target: string
  /** Якорь после #, если указан */
  anchor?: string
  raw: string
}

export interface BacklinkSnippet {
  before: string
  match: string
  after: string
}

export interface BacklinkRef {
  id: string
  title: string
  snippets: BacklinkSnippet[]
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

const WIKI_RE = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g
const EMBED_RE = /!\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g
const FENCE_LINE_RE = /^\s*```/
/** #tag — не заголовок Markdown (# + пробел) и не ##.
 * Границу слова через lookahead: `\b` в JS смотрит только ASCII. */
const TAG_RE = /(^|[^#\p{L}\p{N}_-])#([\p{L}\p{N}_-]{2,40})(?![\p{L}\p{N}_-])/gu

function splitTargetAnchor(rawTarget: string): { target: string; anchor?: string } {
  const raw = String(rawTarget || "").trim()
  const hash = raw.indexOf("#")
  if (hash < 0) return { target: raw }
  const target = raw.slice(0, hash).trim()
  const anchor = raw.slice(hash + 1).trim()
  return anchor ? { target, anchor } : { target }
}

function withAnchor(target: string, anchor?: string): string {
  return anchor ? `${target}#${anchor}` : target
}

function lineRanges(src: string): { start: number; end: number; text: string }[] {
  const ranges: { start: number; end: number; text: string }[] = []
  let start = 0
  for (let i = 0; i <= src.length; i++) {
    if (i === src.length || src[i] === "\n") {
      ranges.push({ start, end: i, text: src.slice(start, i) })
      start = i + 1
    }
  }
  return ranges
}

function fencedLineMask(lines: string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false)
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || ""
    if (FENCE_LINE_RE.test(line)) {
      mask[i] = true
      inFence = !inFence
      continue
    }
    mask[i] = inFence
  }
  return mask
}

function maskedFenceSource(src: string): string {
  const ranges = lineRanges(src)
  const mask = fencedLineMask(ranges.map((r) => r.text))
  let out = ""
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i]!
    out += mask[i] ? " ".repeat(r.end - r.start) : r.text
    if (r.end < src.length) out += "\n"
  }
  return out
}

function lineIndexForOffset(ranges: { start: number; end: number }[], offset: number): number {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const r = ranges[mid]!
    if (offset < r.start) hi = mid - 1
    else if (offset > r.end) lo = mid + 1
    else return mid
  }
  return Math.max(0, Math.min(ranges.length - 1, lo))
}

function snippetForMatch(src: string, index: number, raw: string): BacklinkSnippet {
  const ranges = lineRanges(src)
  const line = lineIndexForOffset(ranges, index)
  const beforeStart = Math.max(0, line - 2)
  const afterEnd = Math.min(ranges.length - 1, line + 2)
  return {
    before: ranges.slice(beforeStart, line).map((r) => r.text).join("\n"),
    match: raw,
    after: ranges.slice(line + 1, afterEnd + 1).map((r) => r.text).join("\n"),
  }
}

function escapeRegExp(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function titleKeyMatches(linkTarget: string, wanted: string): boolean {
  const a = splitTargetAnchor(linkTarget).target
  return normalizeNoteTitleKey(a) === normalizeNoteTitleKey(wanted)
}

export function extractWikiLinks(body: string): WikiLinkRef[] {
  const out: WikiLinkRef[] = []
  const seen = new Set<string>()
  const src = String(body ?? "")
  WIKI_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKI_RE.exec(src))) {
    // Не считать ![[embed]] обычной wiki-ссылкой (см. extractEmbeds).
    if (m.index > 0 && src[m.index - 1] === "!") continue
    const parsed = splitTargetAnchor(m[1] || "")
    const target = parsed.target
    if (!target) continue
    const defaultLabel = withAnchor(target, parsed.anchor)
    const label = ((m[2] || defaultLabel).trim()) || defaultLabel
    const key = normalizeNoteTitleKey(target) + "\0" + (parsed.anchor || "") + "\0" + label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const ref: WikiLinkRef = { target, label, raw: m[0] }
    if (parsed.anchor) ref.anchor = parsed.anchor
    out.push(ref)
  }
  return out
}

export function extractEmbeds(body: string): EmbedRef[] {
  const out: EmbedRef[] = []
  const src = String(body ?? "")
  EMBED_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = EMBED_RE.exec(src))) {
    const parsed = splitTargetAnchor(m[1] || "")
    if (!parsed.target) continue
    const ref: EmbedRef = { target: parsed.target, raw: m[0] }
    if (parsed.anchor) ref.anchor = parsed.anchor
    out.push(ref)
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
  const parsed = splitTargetAnchor(target)
  const t = parsed.target
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
      const toId = resolveWikiTarget(withAnchor(link.target, link.anchor), byTitle)
      if (toId) addEdge({ from: n.id, to: toId, kind: "wiki" })
    }
    for (const emb of extractEmbeds(n.body || "")) {
      const toId = resolveWikiTarget(withAnchor(emb.target, emb.anchor), byTitle)
      if (toId) addEdge({ from: n.id, to: toId, kind: "wiki" })
    }
  }

  return { nodes, edges }
}

/** Заметки, которые ссылаются на noteId через [[...]], со сниппетами ±2 строки. */
export function findBacklinks(
  noteId: string,
  noteTitle: string,
  notes: { id: string; title?: string | null; body?: string | null; conflict_of?: string | null }[]
): BacklinkRef[] {
  const titleKey = normalizeNoteTitleKey(noteTitle)
  const out: BacklinkRef[] = []
  for (const n of notes) {
    if (!n || n.conflict_of || n.id === noteId) continue
    const body = String(n.body || "")
    const snippets: BacklinkSnippet[] = []
    WIKI_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WIKI_RE.exec(body))) {
      if (m.index > 0 && body[m.index - 1] === "!") continue
      const parsed = splitTargetAnchor(m[1] || "")
      const targetKey = normalizeNoteTitleKey(parsed.target)
      const matchesId = parsed.target.toLowerCase() === noteId.toLowerCase()
      const matchesTitle = !!titleKey && targetKey === titleKey
      if (matchesId || matchesTitle) snippets.push(snippetForMatch(body, m.index, m[0]))
    }
    if (snippets.length) out.push({ id: n.id, title: n.title || "", snippets })
  }
  return out
}

/** Точные упоминания title вне [[...]] и вне ``` fences. */
export function findUnlinkedMentions(
  title: string,
  notes: { id: string; title?: string | null; body?: string | null; conflict_of?: string | null }[],
  excludeId: string
): BacklinkRef[] {
  const needle = String(title || "").trim()
  if (!needle) return []
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(needle)})(?=$|[^\\p{L}\\p{N}_])`, "gu")
  const out: BacklinkRef[] = []
  for (const n of notes) {
    if (!n || n.conflict_of || n.id === excludeId) continue
    const body = String(n.body || "")
    let masked = maskedFenceSource(body)
    masked = masked.replace(WIKI_RE, (m) => " ".repeat(m.length))
    const snippets: BacklinkSnippet[] = []
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(masked))) {
      const match = m[2] || needle
      const index = m.index + (m[1] || "").length
      snippets.push(snippetForMatch(body, index, match))
    }
    if (snippets.length) out.push({ id: n.id, title: n.title || "", snippets })
  }
  return out
}

/** Заменить первое несвязанное упоминание title на [[title]] (вне wiki и fences). */
export function linkFirstUnlinkedMention(body: string, title: string): string {
  const needle = String(title || "").trim()
  const src = String(body ?? "")
  if (!needle || !src) return src
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(needle)})(?=$|[^\\p{L}\\p{N}_])`, "gu")
  let masked = maskedFenceSource(src)
  masked = masked.replace(WIKI_RE, (m) => " ".repeat(m.length))
  re.lastIndex = 0
  const m = re.exec(masked)
  if (!m) return src
  const match = m[2] || needle
  const index = m.index + (m[1] || "").length
  return src.slice(0, index) + `[[${match}]]` + src.slice(index + match.length)
}

/** Переписать wiki-ссылки на заметку при переименовании title. */
export function rewriteWikiLinks(body: string, oldTitle: string, newTitle: string): string {
  const oldKey = normalizeNoteTitleKey(oldTitle)
  if (!oldKey) return String(body ?? "")
  return String(body ?? "").replace(WIKI_RE, (raw: string, targetRaw: string, labelRaw?: string) => {
    if (!titleKeyMatches(targetRaw, oldTitle)) return raw
    const parsed = splitTargetAnchor(targetRaw)
    const target = withAnchor(newTitle, parsed.anchor)
    return labelRaw === undefined ? `[[${target}]]` : `[[${target}|${labelRaw}]]`
  })
}

/** Сколько wiki/embed ссылок на title (включая ![[…]]). */
export function countWikiLinksToTitle(body: string, title: string): number {
  const key = normalizeNoteTitleKey(title)
  if (!key) return 0
  const src = String(body ?? "")
  let n = 0
  WIKI_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKI_RE.exec(src))) {
    if (titleKeyMatches(m[1] || "", title)) n++
  }
  return n
}

/** Оставить часть графа, достижимую от rootId за depth шагов (для глубины граф неориентированный). */
export function filterEgoGraph(graph: NoteGraph, rootId: string, depth: number): NoteGraph {
  const maxDepth = Math.max(0, Math.floor(depth))
  const nodeIds = new Set(graph.nodes.map((n) => n.id))
  if (!nodeIds.has(rootId)) return { nodes: [], edges: [] }
  const adj = new Map<string, Set<string>>()
  for (const n of graph.nodes) adj.set(n.id, new Set())
  for (const e of graph.edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue
    adj.get(e.from)!.add(e.to)
    adj.get(e.to)!.add(e.from)
  }
  const keep = new Set<string>([rootId])
  const q: { id: string; d: number }[] = [{ id: rootId, d: 0 }]
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]!
    if (cur.d >= maxDepth) continue
    for (const next of adj.get(cur.id) || []) {
      if (keep.has(next)) continue
      keep.add(next)
      q.push({ id: next, d: cur.d + 1 })
    }
  }
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
  }
}
