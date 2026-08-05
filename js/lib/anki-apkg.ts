/**
 * Базовый импорт Anki .apkg (v1): заметки → карточки Front/Back.
 * Без медиа и без переноса интервалов Anki (карточки как new).
 */
import { unzipSync } from "../vendor/fflate.mjs"
import initSqlJs from "../vendor/sql-asm.mjs"

const FIELD_SEP = "\x1f"

export interface AnkiCardRow {
  front: string
  back: string
}

export interface AnkiDeckImport {
  name: string
  cards: AnkiCardRow[]
}

export interface AnkiApkgParseResult {
  decks: AnkiDeckImport[]
  skippedNotes: number
}

interface AnkiFieldDef {
  name?: string
  ord?: number
}

interface AnkiModel {
  id?: number
  name?: string
  flds?: AnkiFieldDef[]
}

interface AnkiDeckMeta {
  id?: number
  name?: string
}

type SqlJsDatabase = {
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[]
  close: () => void
}

let sqlReady: Promise<new (data?: ArrayLike<number>) => SqlJsDatabase> | null = null

async function getDatabaseCtor() {
  if (!sqlReady) {
    sqlReady = initSqlJs().then((SQL: { Database: new (data?: ArrayLike<number>) => SqlJsDatabase }) => SQL.Database)
  }
  return sqlReady
}

function stripAnkiHtml(s: string): string {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?div[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function pickFrontBack(fields: string[], fieldNames: string[]): AnkiCardRow | null {
  const lower = fieldNames.map((n) => n.toLowerCase())
  let frontIdx = lower.findIndex((n) => n === "front" || n === "вопрос" || n === "слово")
  let backIdx = lower.findIndex((n) => n === "back" || n === "ответ" || n === "перевод")
  if (frontIdx < 0) frontIdx = 0
  if (backIdx < 0) backIdx = Math.min(1, fields.length - 1)
  if (backIdx === frontIdx && fields.length > 1) backIdx = frontIdx === 0 ? 1 : 0
  const front = stripAnkiHtml(fields[frontIdx] || "")
  const back = stripAnkiHtml(fields[backIdx] || "")
  if (!front && !back) return null
  return { front: front || "…", back }
}

function tableRows(db: SqlJsDatabase, sql: string): Record<string, unknown>[] {
  const blocks = db.exec(sql)
  if (!blocks.length) return []
  const block = blocks[0]
  if (!block) return []
  return block.values.map((row) => {
    const obj: Record<string, unknown> = {}
    block.columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj
  })
}

function findCollectionBytes(files: Record<string, Uint8Array>): Uint8Array {
  const names = Object.keys(files)
  const prefer = ["collection.anki21", "collection.anki2"]
  for (const name of prefer) {
    const hit = names.find((n) => n === name || n.endsWith("/" + name))
    if (hit && files[hit]) return files[hit]
  }
  throw new Error("collection.anki2 / collection.anki21 not found in .apkg")
}

/**
 * Распаковать .apkg и извлечь колоды → карточки (одна карточка на note).
 */
export async function parseApkg(input: ArrayBuffer | Uint8Array): Promise<AnkiApkgParseResult> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes) as Record<string, Uint8Array>
  } catch {
    throw new Error("Not a valid .apkg (zip) file")
  }

  const colBytes = findCollectionBytes(files)
  const Database = await getDatabaseCtor()
  const db = new Database(colBytes)
  try {
    const colRows = tableRows(db, "SELECT models, decks FROM col LIMIT 1")
    if (!colRows.length) throw new Error("Empty Anki collection")
    const col = colRows[0]!
    const models = JSON.parse(String(col.models || "{}")) as Record<string, AnkiModel>
    const decksMeta = JSON.parse(String(col.decks || "{}")) as Record<string, AnkiDeckMeta>

    const modelFields = new Map<number, string[]>()
    for (const m of Object.values(models)) {
      if (m?.id == null) continue
      const flds = Array.isArray(m.flds) ? m.flds : []
      const names = flds
        .slice()
        .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
        .map((f) => String(f.name || ""))
      modelFields.set(Number(m.id), names)
    }

    const notes = tableRows(db, "SELECT id, mid, flds FROM notes")
    const cards = tableRows(db, "SELECT nid, did, ord FROM cards ORDER BY nid, ord")

    /** Первый шаблон карточки на note определяет колоду. */
    const noteDeck = new Map<number, number>()
    for (const c of cards) {
      const nid = Number(c.nid)
      if (!noteDeck.has(nid)) noteDeck.set(nid, Number(c.did))
    }

    const byDeck = new Map<string, AnkiCardRow[]>()
    let skippedNotes = 0

    for (const note of notes) {
      const nid = Number(note.id)
      const mid = Number(note.mid)
      const flds = String(note.flds || "").split(FIELD_SEP)
      const names = modelFields.get(mid) || flds.map((_, i) => `Field ${i + 1}`)
      const row = pickFrontBack(flds, names)
      if (!row) {
        skippedNotes++
        continue
      }
      const did = noteDeck.get(nid)
      const deckName =
        (did != null && decksMeta[String(did)]?.name) ||
        (did != null && decksMeta[did as unknown as string]?.name) ||
        "Anki"
      // Пропускаем корневую «Default» только если имя пустое — иначе сохраняем как есть.
      const name = String(deckName || "Anki").replace(/^::/, "") || "Anki"
      const leaf = name.includes("::") ? name.split("::").pop() || name : name
      const list = byDeck.get(leaf) || []
      list.push(row)
      byDeck.set(leaf, list)
    }

    const decks: AnkiDeckImport[] = [...byDeck.entries()]
      .filter(([, cardsList]) => cardsList.length > 0)
      .map(([name, cardsList]) => ({ name, cards: cardsList }))

    return { decks, skippedNotes }
  } finally {
    db.close()
  }
}
