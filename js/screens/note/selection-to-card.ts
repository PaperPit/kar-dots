/**
 * Вычисление якоря и подготовка карточки из выделения заметки.
 */
import { slugify } from "../../lib/markdown.js"

/** Ближайший # заголовок выше позиции курсора (по строкам body). */
export function nearestHeadingAnchor(body: string, cursorPos: number): string | null {
  const before = String(body || "").slice(0, Math.max(0, cursorPos))
  const lines = before.replace(/\r\n?/g, "\n").split("\n")
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i] || "")
    if (m) return slugify(m[2]!.trim()) || null
  }
  return null
}

export function selectionToCardPayload(opts: {
  selection: string
  noteId: string
  body: string
  cursorPos: number
  folderId?: string | null
}): {
  front: string
  back: string
  folder_id: string | null
  note_id: string
  note_anchor: string | null
} {
  const front = String(opts.selection || "").trim()
  return {
    front,
    back: "",
    folder_id: opts.folderId || null,
    note_id: opts.noteId,
    note_anchor: nearestHeadingAnchor(opts.body, opts.cursorPos),
  }
}
