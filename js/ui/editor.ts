/**
 * Обёртка CodeMirror 6 для заметок: Markdown, autocomplete [[ и #,
 * line numbers, create-new для wiki.
 */
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  drawSelection,
  highlightActiveLine,
  dropCursor,
  lineNumbers,
  EditorState,
  EditorSelection,
  Compartment,
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  markdown,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  autocompletion,
  completionKeymap,
  CompletionContext,
  searchKeymap,
  type Extension,
  type ViewUpdate,
} from "../vendor/codemirror.mjs"

export type WikiSuggest = { title: string; id?: string }
export type TagSuggest = string

export interface NoteCmEditorOpts {
  parent: HTMLElement
  doc?: string
  placeholder?: string
  ariaLabel?: string
  lineNumbers?: boolean
  onChange?: (value: string) => void
  onSelectionChange?: (info: { empty: boolean; text: string; from: number; to: number }) => void
  getWikiSuggestions?: () => WikiSuggest[]
  getTagSuggestions?: () => TagSuggest[]
  /** Создать заметку из autocomplete и вернуть title для вставки */
  onCreateWikiNote?: (title: string) => void | Promise<void>
}

export interface NoteCmEditor {
  readonly dom: HTMLElement
  getValue(): string
  setValue(value: string): void
  focus(): void
  destroy(): void
  insertAtCursor(text: string): void
  wrapSelection(before: string, after?: string): void
  toggleLinePrefix(prefix: string): void
  toggleCodeFence(): void
  setLineNumbers(on: boolean): void
  getSelection(): { empty: boolean; text: string; from: number; to: number; head: number }
}

function wikiCompletions(
  getWiki: () => WikiSuggest[],
  onCreate?: (title: string) => void | Promise<void>
): (context: InstanceType<typeof CompletionContext>) => unknown {
  return (context) => {
    const match = context.matchBefore(/\[\[[^\]\n]*$/)
    if (!match) return null
    if (match.from === match.to && !context.explicit) return null
    const typedRaw = match.text.slice(2)
    const typed = typedRaw.toLowerCase()
    const notes = getWiki().filter((n) => n.title)
    const options = notes
      .filter((n) => !typed || n.title.toLowerCase().includes(typed))
      .slice(0, 40)
      .map((n) => ({
        label: n.title,
        type: "text",
        apply: n.title + "]]",
        detail: n.id ? "note" : undefined,
      }))

    const exact = notes.some((n) => n.title.toLowerCase() === typed)
    if (typedRaw.trim() && !exact && onCreate) {
      const title = typedRaw.trim()
      options.unshift({
        label: title,
        type: "text",
        detail: "new",
        apply: (view: InstanceType<typeof EditorView>, _c: unknown, from: number, to: number) => {
          // Вставляем сразу — иначе после await createNote from/to устаревают.
          view.dispatch({
            changes: { from, to, insert: title + "]]" },
            selection: EditorSelection.cursor(from + title.length + 2),
          })
          void Promise.resolve(onCreate(title)).catch(() => { /* toast в экране */ })
        },
      } as never)
    }
    return { from: match.from + 2, options, validFor: /[^\]\n]*/ }
  }
}

function tagCompletions(
  getTags: () => TagSuggest[]
): (context: InstanceType<typeof CompletionContext>) => unknown {
  return (context) => {
    const match = context.matchBefore(/(^|[^#\p{L}\p{N}_-])#[\p{L}\p{N}_-]{0,40}$/u)
    if (!match) return null
    const hashAt = match.text.lastIndexOf("#")
    if (hashAt < 0) return null
    const typed = match.text.slice(hashAt + 1).toLowerCase()
    if (match.text.slice(hashAt + 1).startsWith(" ")) return null
    const known = new Set(getTags().map((t) => t.toLowerCase()))
    if (typed && !known.has(typed)) known.add(typed)
    const options = [...known]
      .filter((t) => t && (!typed || t.startsWith(typed)))
      .sort()
      .slice(0, 30)
      .map((t) => ({
        label: "#" + t,
        type: "keyword",
        apply: "#" + t,
      }))
    return {
      from: match.from + hashAt,
      options,
      validFor: /#[\p{L}\p{N}_-]*/u,
    }
  }
}

const baseTheme = EditorView.theme({
  "&": {
    fontSize: "var(--fs-body)",
    fontFamily: "var(--font-text)",
    color: "var(--c-ink)",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    fontFamily: "var(--font-text)",
    caretColor: "var(--c-ink)",
    padding: "var(--sp-4)",
    minHeight: "42vh",
    lineHeight: "var(--lh-loose)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-text)",
    lineHeight: "var(--lh-loose)",
    overflow: "auto",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--c-ink-3)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--c-ink) 4%, transparent)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--c-petrol) 28%, transparent) !important",
  },
  ".cm-cursor": { borderLeftColor: "var(--c-ink)" },
  ".cm-placeholder": { color: "var(--c-ink-2)", fontStyle: "italic" },
  ".cm-tooltip": {
    border: "var(--bw-bold) solid var(--c-ink)",
    borderRadius: "var(--r-1)",
    backgroundColor: "var(--c-paper)",
    color: "var(--c-ink)",
    boxShadow: "var(--sh-1)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-text)",
    fontSize: "var(--fs-small)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--c-ink)",
    color: "var(--c-paper)",
  },
})

export function createNoteEditor(opts: NoteCmEditorOpts): NoteCmEditor {
  const getWiki = opts.getWikiSuggestions || (() => [])
  const getTags = opts.getTagSuggestions || (() => [])
  const gutters = new Compartment()

  const extensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    bracketMatching(),
    EditorView.lineWrapping,
    markdown(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      indentWithTab,
      ...completionKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...defaultKeymap,
    ]),
    autocompletion({
      override: [wikiCompletions(getWiki, opts.onCreateWikiNote), tagCompletions(getTags)],
      activateOnTyping: true,
    }),
    baseTheme,
    gutters.of(opts.lineNumbers ? lineNumbers() : []),
    EditorView.contentAttributes.of({
      "aria-label": opts.ariaLabel || "Note body",
      spellcheck: "true",
    }),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) opts.onChange?.(update.state.doc.toString())
      if (update.docChanged || update.selectionSet) {
        const { from, to, empty } = update.state.selection.main
        const text = empty ? "" : update.state.doc.toString().slice(from, to)
        opts.onSelectionChange?.({ empty, text, from, to })
      }
    }),
  ]

  if (opts.placeholder) extensions.push(cmPlaceholder(opts.placeholder))

  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc || "",
      extensions,
    }),
  })

  view.dom.classList.add("note-cm")
  if (opts.lineNumbers) view.dom.classList.add("note-cm--gutters")

  function dispatchInsert(from: number, to: number, text: string, cursor?: number) {
    const head = cursor ?? from + text.length
    view.dispatch({
      changes: { from, to, insert: text },
      selection: EditorSelection.cursor(head),
      scrollIntoView: true,
    })
    view.focus()
  }

  const api: NoteCmEditor = {
    get dom() {
      return view.dom
    },
    getValue() {
      return view.state.doc.toString()
    },
    setValue(value: string) {
      const cur = view.state.doc.toString()
      if (cur === value) return
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: value },
      })
    },
    focus() {
      view.focus()
    },
    destroy() {
      view.destroy()
    },
    insertAtCursor(text: string) {
      const { from, to } = view.state.selection.main
      dispatchInsert(from, to, text)
    },
    wrapSelection(before: string, after = before) {
      const { from, to, empty } = view.state.selection.main
      if (empty) {
        dispatchInsert(from, to, before + after, from + before.length)
        return
      }
      const selected = view.state.doc.toString().slice(from, to)
      dispatchInsert(from, to, before + selected + after, from + before.length + selected.length + after.length)
    },
    toggleLinePrefix(prefix: string) {
      const { head } = view.state.selection.main
      const line = view.state.doc.lineAt(head)
      const text = line.text
      const bare = prefix.trimEnd()
      const withSpace = bare + " "

      if (bare.startsWith("#")) {
        const body = text.replace(/^#{1,6}\s+/, "")
        const already = new RegExp("^" + bare.replace(/#/g, "#") + "(?:\\s|$)").test(text)
        const out = already ? body : withSpace + body
        dispatchInsert(line.from, line.to, out, line.from + out.length)
        return
      }

      if (bare === "- [ ]" || bare === "- [x]") {
        const taskRe = /^- \[[ xX]\]\s?/
        const out = taskRe.test(text)
          ? text.replace(taskRe, "")
          : withSpace + text.replace(/^\s+/, "").replace(/^[-*+]\s+/, "")
        dispatchInsert(line.from, line.to, out, line.from + out.length)
        return
      }

      const esc = bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const re = new RegExp("^" + esc + "\\s?")
      const out = re.test(text)
        ? text.replace(re, "")
        : withSpace + text.replace(/^\s+/, "").replace(/^[-*+]\s+/, "").replace(/^>\s?/, "")
      dispatchInsert(line.from, line.to, out, line.from + out.length)
    },
    toggleCodeFence() {
      const { from, to, empty } = view.state.selection.main
      if (empty) {
        dispatchInsert(from, to, "```\n\n```", from + 4)
        return
      }
      const selected = view.state.doc.toString().slice(from, to)
      const wrapped = "```\n" + selected + "\n```"
      dispatchInsert(from, to, wrapped, from + wrapped.length)
    },
    setLineNumbers(on: boolean) {
      view.dispatch({ effects: gutters.reconfigure(on ? lineNumbers() : []) })
      view.dom.classList.toggle("note-cm--gutters", on)
    },
    getSelection() {
      const { from, to, empty, head } = view.state.selection.main
      return {
        empty,
        from,
        to,
        head,
        text: empty ? "" : view.state.doc.toString().slice(from, to),
      }
    },
  }

  return api
}
