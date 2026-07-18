const SEP_RE = /\s*(?:—|\||\t|\s-\s)\s*/

/**
 * Парсит строки формата «слово — перевод».
 * @returns {{ rows: { front: string, back: string }[], skipped: number, wordOnly: string[] }}
 */
interface ParsedRow {
  front: string
  back: string
}

export function parseBulkLines(text: string): {
  rows: ParsedRow[]
  skipped: number
  wordOnly: string[]
} {
  const rows: ParsedRow[] = []
  const wordOnly: string[] = []
  let skipped = 0
  const seen = new Set<string>()

  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue

    let front = ""
    let back = ""
    const sep = line.match(SEP_RE)
    if (sep) {
      const idx = line.search(SEP_RE)
      front = line.slice(0, idx).trim()
      back = line.slice(idx + sep[0].length).trim()
    } else {
      front = line
    }

    if (!front) {
      skipped++
      continue
    }
    const key = front.toLowerCase()
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)

    if (!back) {
      wordOnly.push(front)
      rows.push({ front, back: "" })
    } else {
      rows.push({ front, back })
    }
  }
  return { rows, skipped, wordOnly }
}

export function countReadyRows(rows: ParsedRow[]): number {
  return rows.filter((r) => r.front && r.back).length
}
