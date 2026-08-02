/**
 * Простой inverted-index FTS для заметок (IndexedDB note_terms).
 * Токены: слова ≥2 символов, нижний регистр, латиница + кириллица + цифры.
 */

export interface NoteTermRow {
  id: string
  note_id: string
  term: string
}

const TERM_RE = /[\p{L}\p{N}]{2,}/gu

export function tokenizeNotesText(...parts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const s = String(part ?? "").toLowerCase()
    let m: RegExpExecArray | null
    TERM_RE.lastIndex = 0
    while ((m = TERM_RE.exec(s))) {
      const t = m[0]
      if (seen.has(t)) continue
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

export function buildNoteTermRows(
  noteId: string,
  title: string,
  body: string,
  tags: string[] = []
): NoteTermRow[] {
  return tokenizeNotesText(title, body, tags.join(" ")).map((term) => ({
    id: noteId + ":" + term,
    note_id: noteId,
    term,
  }))
}

/**
 * Return known terms that start with prefix. IndexedDB callers should prefer
 * `IDBKeyRange.bound(term, term + "\uffff")` on the `term` index instead of
 * collecting every term in memory.
 */
export function matchPrefixTerms(allTerms: string[], prefix: string): string[] {
  const p = String(prefix || "").toLowerCase()
  if (!p) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of allTerms) {
    const t = String(term || "").toLowerCase()
    if (!t || seen.has(t) || !t.startsWith(p)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Ранжирование: сколько уникальных токенов запроса нашлось в заметке.
 * noteIdsByTerm — Map<term, noteId[]>
 */
export function rankNoteSearch(
  queryTerms: string[],
  noteIdsByTerm: Map<string, string[]>
): { noteId: string; score: number }[] {
  if (!queryTerms.length) return []
  const scores = new Map<string, number>()
  for (const term of queryTerms) {
    const ids = noteIdsByTerm.get(term) || []
    for (const id of ids) scores.set(id, (scores.get(id) || 0) + 1)
  }
  return [...scores.entries()]
    .map(([noteId, score]) => ({ noteId, score }))
    .sort((a, b) => b.score - a.score || a.noteId.localeCompare(b.noteId))
}
