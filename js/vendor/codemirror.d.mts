export type Extension = unknown
export type ViewUpdate = {
  docChanged: boolean
  selectionSet: boolean
  state: EditorState
}

export declare class EditorView {
  constructor(config?: Record<string, unknown>)
  readonly state: EditorState
  readonly dom: HTMLElement
  readonly contentDOM: HTMLElement
  dispatch(...specs: unknown[]): void
  focus(): void
  destroy(): void
  static updateListener: { of(fn: (update: ViewUpdate) => void): Extension }
  static theme(spec: Record<string, unknown>, options?: { dark?: boolean }): Extension
  static lineWrapping: Extension
  static editable: { of(v: boolean): Extension }
  static contentAttributes: { of(attrs: Record<string, string>): Extension }
  static domEventHandlers(handlers: Record<string, unknown>): Extension
}

export declare class EditorState {
  doc: {
    toString(): string
    length: number
    lineAt(pos: number): { from: number; to: number; number: number; text: string }
  }
  selection: { main: { from: number; to: number; head: number; empty: boolean } }
  static create(config?: Record<string, unknown>): EditorState
}

export declare class EditorSelection {
  static single(anchor: number, head?: number): unknown
  static cursor(pos: number): unknown
}

export declare class Compartment {
  of(ext: Extension): Extension
  reconfigure(ext: Extension): unknown
  get(state: EditorState): Extension | undefined
}

export declare class Prec {
  static high(ext: Extension): Extension
}

export declare class CompletionContext {
  state: EditorState
  pos: number
  explicit: boolean
  matchBefore(re: RegExp): { from: number; to: number; text: string } | null
}

export declare const keymap: {
  of(map: readonly unknown[]): Extension
}
export declare function placeholder(text: string): Extension
export declare function drawSelection(config?: Record<string, unknown>): Extension
export declare function highlightActiveLine(): Extension
export declare const dropCursor: Extension

export declare const defaultKeymap: unknown[]
export declare function history(): Extension
export declare const historyKeymap: unknown[]
export declare const indentWithTab: { key: string; run: (view: EditorView) => boolean }

export declare function markdown(config?: Record<string, unknown>): Extension
export declare function syntaxHighlighting(style: unknown, options?: Record<string, unknown>): Extension
export declare const defaultHighlightStyle: unknown
export declare function bracketMatching(): Extension

export declare function autocompletion(config?: {
  override?: Array<(context: CompletionContext) => unknown>
  activateOnTyping?: boolean
}): Extension
export declare const completionKeymap: unknown[]
export declare const searchKeymap: unknown[]
