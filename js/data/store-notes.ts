/**
 * Общие операции с заметками в IndexedDB-зеркале (LocalStore / CloudStore).
 */
import {
  getAll, mirrorPut, mirrorDelete, indexGetAll,
} from "./sync-queue.js"
import { buildNoteTermRows, tokenizeNotesText, rankNoteSearch } from "../lib/notes-fts.js"
import { noteTitleFromBody } from "../lib/markdown.js"
import { buildNoteRecord } from "./store-contract.js"
import type { Note, Card } from "./types.js"

export async function putNoteInMirror(db: IDBDatabase, row: Note): Promise<void> {
  await mirrorPut(db, "notes", row)
  if (row.conflict_of) {
    await mirrorPut(db, "note_conflicts", row)
  } else {
    await mirrorDelete(db, "note_conflicts", row.id)
  }
  await reindexNoteTerms(db, row)
}

export async function reindexNoteTerms(db: IDBDatabase, note: Note): Promise<void> {
  const old = await indexGetAll<{ id: string }>(db, "note_terms", "note_id", note.id)
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("note_terms", "readwrite")
    const s = t.objectStore("note_terms")
    for (const row of old) s.delete(row.id)
    for (const row of buildNoteTermRows(note.id, note.title || "", note.body || "")) {
      s.put(row)
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function clearNoteTerms(db: IDBDatabase, noteId: string): Promise<void> {
  const old = await indexGetAll<{ id: string }>(db, "note_terms", "note_id", noteId)
  if (!old.length) return
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("note_terms", "readwrite")
    const s = t.objectStore("note_terms")
    for (const row of old) s.delete(row.id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function deleteNoteFromMirror(db: IDBDatabase, id: string): Promise<Card[]> {
  const linked = await indexGetAll<Card>(db, "cards", "note_id", id)
  for (const c of linked) {
    if (!c.id) continue
    const next = Object.assign({}, c, { note_id: null, note_anchor: null })
    await mirrorPut(db, "cards", next)
  }
  const conflicts = await indexGetAll<Note>(db, "note_conflicts", "conflict_of", id)
  for (const c of conflicts) {
    await mirrorDelete(db, "notes", c.id)
    await mirrorDelete(db, "note_conflicts", c.id)
    await clearNoteTerms(db, c.id)
  }
  await mirrorDelete(db, "notes", id)
  await mirrorDelete(db, "note_conflicts", id)
  await clearNoteTerms(db, id)
  return linked
}

export async function listNotesFromMirror(
  db: IDBDatabase,
  opts: { includeConflicts?: boolean; query?: string } = {}
): Promise<Note[]> {
  let notes = await getAll<Note>(db, "notes")
  if (!opts.includeConflicts) notes = notes.filter((n) => !n.conflict_of)
  if (opts.query && opts.query.trim()) {
    const ids = await searchNoteIdsInMirror(db, opts.query)
    const allow = new Set(ids)
    notes = notes.filter((n) => allow.has(n.id))
    notes.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  } else {
    notes.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  }
  return notes
}

export async function searchNoteIdsInMirror(db: IDBDatabase, query: string): Promise<string[]> {
  const terms = tokenizeNotesText(query)
  if (!terms.length) return []
  const byTerm = new Map<string, string[]>()
  for (const term of terms) {
    const rows = await indexGetAll<{ note_id: string }>(db, "note_terms", "term", term)
    byTerm.set(term, rows.map((r) => r.note_id))
  }
  return rankNoteSearch(terms, byTerm).map((r) => r.noteId)
}

export async function getNoteFromMirror(db: IDBDatabase, id: string): Promise<Note | null> {
  return new Promise((resolve, reject) => {
    const req = db.transaction("notes").objectStore("notes").get(id)
    req.onsuccess = () => resolve((req.result as Note | undefined) || null)
    req.onerror = () => reject(req.error)
  })
}

export async function getNoteConflictsFromMirror(db: IDBDatabase, noteId: string): Promise<Note[]> {
  const rows = await indexGetAll<Note>(db, "note_conflicts", "conflict_of", noteId)
  rows.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  return rows
}

export function mergeNotePatch(cur: Note, patch: Partial<Note>): Note {
  const next = Object.assign({}, cur, patch, { updated_at: patch.updated_at ?? Date.now() }) as Note
  if (patch.body != null && (patch.title == null || patch.title === "")) {
    next.title = noteTitleFromBody(next.body, cur.title || "")
  }
  return next
}

export function makeConflictCopy(winnerId: string, loser: Partial<Note>): Note {
  return buildNoteRecord({
    title: loser.title,
    body: loser.body,
    conflict_of: winnerId,
    created_at: loser.created_at,
    updated_at: loser.updated_at || Date.now(),
  })
}

/** Разложить облачные заметки: основные → notes, conflict-копии → note_conflicts (+ notes). */
export async function replaceNotesMirror(db: IDBDatabase, rows: Note[]): Promise<void> {
  const primaries = rows.filter((n) => !n.conflict_of)
  const conflicts = rows.filter((n) => !!n.conflict_of)
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(["notes", "note_conflicts", "note_terms"], "readwrite")
    const notes = t.objectStore("notes")
    const conf = t.objectStore("note_conflicts")
    const terms = t.objectStore("note_terms")
    notes.clear()
    conf.clear()
    terms.clear()
    for (const n of rows) notes.put(n)
    for (const n of conflicts) conf.put(n)
    for (const n of primaries.concat(conflicts)) {
      for (const row of buildNoteTermRows(n.id, n.title || "", n.body || "")) {
        terms.put(row)
      }
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}