import type { Folder, Box, Card } from "../data/types.js"
import type { HomeStats } from "../data/home-stats.js"
import type { SrsRow, Algo } from "../lib/srs.js"

/**
 * Контракт LocalStore — члены, которыми пользуются ui/ и screens/.
 * Канонический список также в `js/data/store-contract.ts` (JSDoc).
 */
export interface AppStore {
  kind: string
  readonly offline: boolean
  folders: Folder[]
  boxes: Box[]
  settings: any

  init(): Promise<void>

  getFolderCards(folderId: string): Promise<any>
  countCards(folderId?: string | null): Promise<number>
  countDue(folderId?: string | null, algo?: Algo): Promise<number>
  countDueBetween(folderId?: string | null, algo?: Algo, from?: number, to?: number): Promise<number>
  countNew(folderId?: string | null, algo?: Algo): Promise<number>
  getHomeStats(): Promise<HomeStats>
  getAllSrsRows(): SrsRow[]
  getReviewCards(
    folderId: string | null,
    algo: Algo,
    newLimit: number,
    now: number
  ): Promise<{ due: any[]; fresh: any[] }>
  getCramCards(folderId: string | null, limit: number | null): Promise<Card[]>
  scanFolderFronts(folderId: string | null, opts?: { youtubeOnly?: boolean }): Promise<{ front: string }[]>

  createFolder(data: any): Promise<any>
  updateFolder(id: string, patch: any): Promise<any>
  deleteFolder(id: string): Promise<unknown>
  createBox(data: any): Promise<any>
  updateBox(id: string, patch: any): Promise<any>
  deleteBox(id: string): Promise<unknown>
  assignFolderToBox(folderId: string, boxId?: string | null): Promise<any>
  setBoxFolders(boxId: string, folderIds: string[]): Promise<unknown>

  findFolderByPackId(packId: string): Folder | null | undefined
  importVocabPack(pack: any, onProgress?: (info: any) => void): Promise<Folder>
  deleteVocabPack(packId: string): Promise<unknown>

  createCard(data: any): Promise<any>
  updateCard(id: string, patch: any): Promise<any>
  deleteCard(id: string): Promise<unknown>
  uploadImage(file: Blob, opts?: { side?: string; cardId?: string }): Promise<string>
  deleteImage(url?: string): Promise<unknown>

  listNotes(opts?: {
    includeConflicts?: boolean
    query?: string
    folderId?: string | null
    tag?: string | null
  }): Promise<any[]>
  searchNoteIds?(query: string): Promise<string[]>
  getNote(id: string): Promise<any>
  getNoteConflicts(noteId: string): Promise<any[]>
  createNote(data?: any): Promise<any>
  updateNote(id: string, patch: any): Promise<any>
  createNoteConflictCopy?(winnerId: string, loser: any): Promise<any>
  deleteNote(id: string): Promise<unknown>
  getNoteCards(noteId: string): Promise<any[]>
  linkCardToNote(cardId: string, noteId: string, anchor?: string | null): Promise<any>
  unlinkCardFromNote(cardId: string): Promise<any>

  saveSettings(s: any): Promise<any>
  exportJSONFull(): Promise<string>
  importJSON(text: string): Promise<unknown>

  pendingSync(): Promise<number>
  deadLetterCount(): Promise<number>
  deadLetters(): Promise<any[]>
  retryDeadLetter(id: number): Promise<boolean>
  discardDeadLetter(id: number): Promise<boolean>
  flushSync(): Promise<{ ok: number; fail: number }>
  _invalidateHomeStats(): void
  onSyncChange?(fn: (state: any) => void): void
  syncReviewLogFromCloud?(): Promise<number>
  schemaWarning?: string | null
}

export interface Config {
  /** @deprecated ignored — sync is Cloudflare D1/R2 */
  SUPABASE_URL?: string
  /** @deprecated ignored */
  SUPABASE_ANON_KEY?: string
  [key: string]: unknown
}

let cfg = {} as Config
/** @deprecated always false — legacy Supabase cloud removed */
let cloudConfigured = false

let store: AppStore = null as unknown as AppStore
/** @deprecated always null — MiniSupabase removed */
let sb: null = null

export const app =
  typeof document !== "undefined"
    ? (document.getElementById("app") as HTMLElement)
    : (null as unknown as HTMLElement)

/** Загружает config.js или config.example.js (на хостинге config.js часто отсутствует). */
export async function initConfig(): Promise<void> {
  cfg = {} as Config
  for (const path of ["../config.js", "../config.example.js"]) {
    try {
      const mod = await import(path)
      if (mod.default && typeof mod.default === "object") {
        cfg = mod.default
        break
      }
    } catch {
      /* пробуем следующий файл */
    }
  }
  cloudConfigured = false
}

export function setStore(s: AppStore | null): void {
  store = s as AppStore
}

/** @deprecated no-op */
export function setSb(_s: unknown): void {
  sb = null
}

export { store, sb, cloudConfigured, cfg }
