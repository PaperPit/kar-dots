/**
 * Лёгкий Markdown → HTML и утилиты для заметок.
 * Без внешних зависимостей: заголовки, списки, код, ссылки, картинки,
 * wiki [[...]], хештеги #tag, жирный/курсив.
 */

import {
  extractWikiLinks,
  normalizeNoteTitleKey,
  resolveWikiTarget,
  type WikiLinkRef,
} from "./note-links.js"

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

export interface MarkdownRenderOpts {
  /** title/id → noteId для [[wiki]] */
  wikiIndex?: Map<string, string>
}

const IMG_SRC_RE = /^(https?:\/\/[^)\s]+|data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+)$/i

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

  raw = raw.replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) => {
    const t = String(target || "").trim()
    const lab = String(label || t).trim() || t
    const id = opts.wikiIndex ? resolveWikiTarget(t, opts.wikiIndex) : null
    if (id) {
      return park(
        `<a class="md-wiki" href="#note/${escapeHtml(id)}" data-note-id="${escapeHtml(id)}">${escapeHtml(lab)}</a>`
      )
    }
    return park(`<span class="md-wiki md-wiki--missing" title="${escapeHtml(t)}">${escapeHtml(lab)}</span>`)
  })

  let s = escapeHtml(raw)

  // Inline-разметка до возврата плейсхолдеров — иначе #tag цепляется к href="#note/…".
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>")
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
  s = s.replace(/\u0000MD(\d+)\u0000/g, (_m, n) => slots[Number(n)] || "")
  return s
}

/**
 * Рендер Markdown в безопасный HTML (только известные конструкции).
 */
export function renderMarkdown(src: string, opts: MarkdownRenderOpts = {}): string {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n")
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

export { extractWikiLinks, normalizeNoteTitleKey, resolveWikiTarget }
export type { WikiLinkRef }
