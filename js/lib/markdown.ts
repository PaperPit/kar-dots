/**
 * Лёгкий Markdown → HTML и утилиты для заметок.
 * Без внешних зависимостей: заголовки, списки, код, ссылки, жирный/курсив.
 */

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c] || c)
}

/** Slug для якоря заголовка (# heading → #heading). */
export function slugify(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function inlineMarkdown(text: string): string {
  let s = escapeHtml(text)
  // code `...`
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
  // bold **...** / __...__
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>")
  // italic *...* / _..._
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
  s = s.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>")
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
  return s
}

/**
 * Рендер Markdown в безопасный HTML (только известные конструкции).
 */
export function renderMarkdown(src: string): string {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []
  let i = 0
  let inUl = false
  let inOl = false
  let inCode = false
  let codeBuf: string[] = []

  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false }
    if (inOl) { out.push("</ol>"); inOl = false }
  }

  while (i < lines.length) {
    const line = lines[i] ?? ""

    if (inCode) {
      if (/^```/.test(line)) {
        out.push("<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>")
        codeBuf = []
        inCode = false
      } else {
        codeBuf.push(line)
      }
      i++
      continue
    }

    if (/^```/.test(line)) {
      closeLists()
      inCode = true
      codeBuf = []
      i++
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      closeLists()
      const level = heading[1]!.length
      const text = heading[2]!.trim()
      const id = slugify(text)
      out.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(text)}</h${level}>`)
      i++
      continue
    }

    const ul = /^[-*+]\s+(.+)$/.exec(line)
    if (ul) {
      if (inOl) { out.push("</ol>"); inOl = false }
      if (!inUl) { out.push("<ul>"); inUl = true }
      out.push("<li>" + inlineMarkdown(ul[1]!) + "</li>")
      i++
      continue
    }

    const ol = /^\d+\.\s+(.+)$/.exec(line)
    if (ol) {
      if (inUl) { out.push("</ul>"); inUl = false }
      if (!inOl) { out.push("<ol>"); inOl = true }
      out.push("<li>" + inlineMarkdown(ol[1]!) + "</li>")
      i++
      continue
    }

    if (!line.trim()) {
      closeLists()
      i++
      continue
    }

    closeLists()
    out.push("<p>" + inlineMarkdown(line) + "</p>")
    i++
  }

  if (inCode) out.push("<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>")
  closeLists()
  return out.join("\n")
}

/** Заголовок из первой строки # ... или первые ~60 символов body. */
export function noteTitleFromBody(body: string, fallback = ""): string {
  const lines = String(body ?? "").replace(/\r\n?/g, "\n").split("\n")
  for (const line of lines) {
    const h = /^#\s+(.+)$/.exec(line.trim())
    if (h) return h[1]!.trim().slice(0, 120)
    if (line.trim()) break
  }
  const plain = String(body ?? "").replace(/[#*_`>\-\[\]()]/g, " ").replace(/\s+/g, " ").trim()
  if (plain) return plain.slice(0, 60) + (plain.length > 60 ? "…" : "")
  return fallback
}

/** Превью для списка: первая непустая строка без разметки. */
export function notePreview(body: string, max = 140): string {
  const plain = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s+/, "").replace(/[`*_\[\]()#>|-]/g, "").trim())
    .find((l) => l.length > 0) || ""
  if (plain.length <= max) return plain
  return plain.slice(0, max - 1) + "…"
}
