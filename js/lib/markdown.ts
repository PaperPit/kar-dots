/**
 * Лёгкий Markdown → HTML и утилиты для заметок.
 * Без внешних зависимостей: заголовки, списки, код, ссылки, картинки,
 * wiki [[...]], хештеги #tag, жирный/курсив.
 */

import { resolveWikiTarget } from "./note-links.js"

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
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

export interface MarkdownRenderOpts {
  /** title/id → noteId для [[wiki]] */
  wikiIndex?: Map<string, string>
  /** target/anchor → безопасный HTML для ![[embed]], null — стандартный плейсхолдер */
  embedResolver?: (target: string, anchor?: string) => string | null
}

const IMG_SRC_RE = /^(https?:\/\/[^)\s]+|data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+)$/i

function splitWikiTarget(rawTarget: string): { target: string; anchor?: string } {
  const raw = String(rawTarget || "").trim()
  const hash = raw.indexOf("#")
  if (hash < 0) return { target: raw }
  const target = raw.slice(0, hash).trim()
  const anchor = raw.slice(hash + 1).trim()
  return anchor ? { target, anchor } : { target }
}

function wikiTargetLabel(target: string, anchor?: string): string {
  return anchor ? `${target}#${anchor}` : target
}

function inlineMarkdown(text: string, opts: MarkdownRenderOpts = {}): string {
  // Защитить wiki и картинки плейсхолдерами до escape
  const slots: string[] = []
  const park = (html: string) => {
    const i = slots.length
    slots.push(html)
    return `\u0000MD${i}\u0000`
  }

  let raw = String(text ?? "")

  raw = raw.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    const s = String(src || "").trim()
    if (!IMG_SRC_RE.test(s)) return _m
    const a = escapeHtml(alt || "")
    return park(
      `<span class="md-figure"><img src="${escapeHtml(s)}" alt="${a}" loading="lazy"/>` +
        (a ? `<span class="md-figcaption">${a}</span>` : "") +
        `</span>`
    )
  })

  raw = raw.replace(/!\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, (_m, rawTarget: string) => {
    const { target, anchor } = splitWikiTarget(rawTarget)
    if (!target) return ""
    const html = opts.embedResolver ? opts.embedResolver(target, anchor) : null
    if (html != null) return park(sanitizeEmbedHtml(html))
    const title = wikiTargetLabel(target, anchor)
    return park(
      `<span class="md-embed md-embed--missing" title="${escapeHtml(title)}">${escapeHtml(title)}</span>`
    )
  })

  raw = raw.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g,
    (_m, rawTarget: string, label?: string) => {
      const { target, anchor } = splitWikiTarget(rawTarget)
      const title = wikiTargetLabel(target, anchor)
      const lab = String(label || title).trim() || title
      const id = opts.wikiIndex ? resolveWikiTarget(target, opts.wikiIndex) : null
      if (id) {
        const href = "#note/" + escapeHtml(id) + (anchor ? "#" + escapeHtml(slugify(anchor)) : "")
        return park(
          `<a class="md-wiki" href="${href}" data-note-id="${escapeHtml(id)}"${anchor ? ` data-heading="${escapeHtml(slugify(anchor))}"` : ""}>${escapeHtml(lab)}</a>`
        )
      }
      return park(
        `<span class="md-wiki md-wiki--missing" title="${escapeHtml(title)}">${escapeHtml(lab)}</span>`
      )
    }
  )

  let s = escapeHtml(raw)

  // Inline-разметка до возврата плейсхолдеров — иначе #tag цепляется к href="#note/…".
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>")
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>")
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
  s = s.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>")
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>'
  )
  s = s.replace(
    /(^|[^#\p{L}\p{N}_-])#([\p{L}\p{N}_-]{2,40})(?![\p{L}\p{N}_-])/gu,
    (_m, pre: string, tag: string) => {
      const t = tag.toLowerCase()
      return `${pre}<a class="md-tag" href="#notes/tag/${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`
    }
  )

  // Плейсхолдеры wiki/картинок — уже безопасный HTML
  // eslint-disable-next-line no-control-regex -- \u0000 — внутренний сентинель-плейсхолдер
  s = s.replace(/\u0000MD(\d+)\u0000/g, (_m, n) => slots[Number(n)] || "")
  return s
}

function splitTableRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith("|")) s = s.slice(1)
  if (s.endsWith("|")) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim())
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
}

function isTableStart(lines: string[], i: number): boolean {
  const head = lines[i] || ""
  const sep = lines[i + 1] || ""
  return head.includes("|") && sep.includes("|") && isTableSeparator(sep)
}

function renderTable(
  lines: string[],
  start: number,
  opts: MarkdownRenderOpts
): { html: string; next: number } {
  const head = splitTableRow(lines[start] || "")
  let i = start + 2
  const rows: string[][] = []
  while (i < lines.length && lines[i]!.trim() && lines[i]!.includes("|")) {
    rows.push(splitTableRow(lines[i]!))
    i++
  }
  const cols = Math.max(head.length, ...rows.map((r) => r.length))
  const pad = (row: string[]) => Array.from({ length: cols }, (_, idx) => row[idx] || "")
  const html = [
    "<table>",
    "<thead><tr>" +
      pad(head)
        .map((cell) => `<th>${inlineMarkdown(cell, opts)}</th>`)
        .join("") +
      "</tr></thead>",
    "<tbody>",
    ...rows.map(
      (row) =>
        "<tr>" +
        pad(row)
          .map((cell) => `<td>${inlineMarkdown(cell, opts)}</td>`)
          .join("") +
        "</tr>"
    ),
    "</tbody>",
    "</table>"
  ].join("\n")
  return { html, next: i }
}

const ALLOWED_EMBED_TAGS = new Set([
  "a",
  "aside",
  "div",
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "mark",
  "code",
  "pre",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img"
])

function sanitizeEmbedHtml(html: string): string {
  const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html")
  function clean(node: Node): string {
    const out: string[] = []
    node.childNodes.forEach((ch) => {
      if (ch.nodeType === Node.TEXT_NODE) {
        out.push(escapeHtml(ch.textContent || ""))
      } else if (ch instanceof Element) {
        const tag = ch.tagName.toLowerCase()
        if (ALLOWED_EMBED_TAGS.has(tag)) {
          const attrs = Array.from(ch.attributes)
            .filter(
              (a) =>
                a.name === "class" ||
                a.name === "href" ||
                a.name === "title" ||
                a.name.startsWith("data-")
            )
            .map((a) => {
              const val = a.name === "href" ? safeHrefAttr(a.value) : escapeHtml(a.value)
              return val ? ` ${a.name}="${val}"` : ""
            })
            .join("")
          out.push(`<${tag}${attrs}>${clean(ch)}</${tag}>`)
        } else {
          out.push(clean(ch))
        }
      }
    })
    return out.join("")
  }
  const first = doc.body.firstChild
  if (!first) return ""
  return clean(first)
}

function safeHrefAttr(href: string): string | null {
  const h = href.trim()
  if (/^(https?:|mailto:|#)/i.test(h)) return escapeHtml(h)
  return null
}

/**
 * Рендер Markdown в безопасный HTML (только известные конструкции).
 */
export function renderMarkdown(src: string, opts: MarkdownRenderOpts = {}): string {
  const lines = String(src ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
  const out: string[] = []
  let i = 0
  let inUl = false
  let inOl = false
  let inCode = false
  let codeBuf: string[] = []

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>")
      inUl = false
    }
    if (inOl) {
      out.push("</ol>")
      inOl = false
    }
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

    if (isTableStart(lines, i)) {
      closeLists()
      const table = renderTable(lines, i, opts)
      out.push(table.html)
      i = table.next
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      closeLists()
      const level = heading[1]!.length
      const text = heading[2]!.trim()
      const id = slugify(text)
      out.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(text, opts)}</h${level}>`)
      i++
      continue
    }

    const bq = /^>\s?(.*)$/.exec(line)
    if (bq) {
      closeLists()
      out.push("<blockquote><p>" + inlineMarkdown(bq[1]!, opts) + "</p></blockquote>")
      i++
      continue
    }

    const task = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    if (task) {
      if (inOl) {
        out.push("</ol>")
        inOl = false
      }
      if (!inUl) {
        out.push('<ul class="md-task-list">')
        inUl = true
      }
      const checked = /[xX]/.test(task[1]!)
      out.push(
        `<li class="md-task"><input type="checkbox" disabled${checked ? " checked" : ""}/> ` +
          inlineMarkdown(task[2]!, opts) +
          "</li>"
      )
      i++
      continue
    }

    const ul = /^[-*+]\s+(.+)$/.exec(line)
    if (ul) {
      if (inOl) {
        out.push("</ol>")
        inOl = false
      }
      if (!inUl) {
        out.push("<ul>")
        inUl = true
      }
      out.push("<li>" + inlineMarkdown(ul[1]!, opts) + "</li>")
      i++
      continue
    }

    const ol = /^\d+\.\s+(.+)$/.exec(line)
    if (ol) {
      if (inUl) {
        out.push("</ul>")
        inUl = false
      }
      if (!inOl) {
        out.push("<ol>")
        inOl = true
      }
      out.push("<li>" + inlineMarkdown(ol[1]!, opts) + "</li>")
      i++
      continue
    }

    if (!line.trim()) {
      closeLists()
      i++
      continue
    }

    closeLists()
    out.push("<p>" + inlineMarkdown(line, opts) + "</p>")
    i++
  }

  if (inCode) out.push("<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>")
  closeLists()
  return out.join("\n")
}

/** Заголовок из первой строки # ... или первые ~60 символов body. */
export function noteTitleFromBody(body: string, fallback = ""): string {
  const lines = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
  for (const line of lines) {
    const h = /^#\s+(.+)$/.exec(line.trim())
    if (h) return h[1]!.trim().slice(0, 120)
    if (line.trim()) break
  }
  const plain = String(body ?? "")
    .replace(/[#*_`>\-\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (plain) return plain.slice(0, 60) + (plain.length > 60 ? "…" : "")
  return fallback
}

/** Превью для списка: первая непустая строка без разметки. */
export function notePreview(body: string, max = 140): string {
  const plain =
    String(body ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((l) =>
        l
          .replace(/^#{1,6}\s+/, "")
          .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
          .replace(/\[\[[^\]]+\]\]/g, (w) => w.replace(/[\[\]]/g, ""))
          .replace(/[`*_\[\]()#>|-]/g, "")
          .trim()
      )
      .find((l) => l.length > 0) || ""
  if (plain.length <= max) return plain
  return plain.slice(0, max - 1) + "…"
}

export { extractWikiLinks, normalizeNoteTitleKey, resolveWikiTarget } from "./note-links.js"
export type { WikiLinkRef } from "./note-links.js"
