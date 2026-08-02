/**
 * Entry для esbuild → js/vendor/codemirror.mjs
 * Реэкспорт только того, что нужно заметкам.
 */
export {
  EditorView,
  keymap,
  placeholder,
  drawSelection,
  highlightActiveLine,
  dropCursor,
  lineNumbers,
} from "@codemirror/view"

export {
  EditorState,
  Compartment,
  Prec,
  EditorSelection,
} from "@codemirror/state"

export {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"

export { markdown } from "@codemirror/lang-markdown"

export {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from "@codemirror/language"

export {
  autocompletion,
  completionKeymap,
  CompletionContext,
} from "@codemirror/autocomplete"

export { searchKeymap } from "@codemirror/search"
