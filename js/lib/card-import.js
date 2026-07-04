const SEP_RE = /\s*(?:—|\||\t|\s-\s)\s*/;

/**
 * Парсит строки формата «слово — перевод».
 * @returns {{ rows: { front: string, back: string }[], skipped: number, wordOnly: string[] }}
 */
export function parseBulkLines(text) {
  const rows = [];
  const wordOnly = [];
  let skipped = 0;
  const seen = new Set();

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    let front = '';
    let back = '';
    const sep = line.match(SEP_RE);
    if (sep) {
      const idx = line.search(SEP_RE);
      front = line.slice(0, idx).trim();
      back = line.slice(idx + sep[0].length).trim();
    } else {
      front = line;
    }

    if (!front) { skipped++; continue; }
    const key = front.toLowerCase();
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    if (!back) {
      wordOnly.push(front);
      rows.push({ front, back: '' });
    } else {
      rows.push({ front, back });
    }
  }
  return { rows, skipped, wordOnly };
}

export function countReadyRows(rows) {
  return rows.filter(r => r.front && r.back).length;
}
