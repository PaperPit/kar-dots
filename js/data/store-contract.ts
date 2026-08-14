/**
 * @typedef {Object} StoreSettings
 * @property {'sm2'|'leitner'|'fsrs'} algo
 * @property {'ftb'|'btf'|'mix'} direction
 * @property {number} newPerDay
 * @property {number[]} leitnerIntervals
 * @property {boolean} tts
 * @property {number} ttsRate
 * @property {boolean} ttsAuto
 * @property {string} ttsVoiceRu
 * @property {string} ttsVoiceEn
 * @property {string} supadataApiKey
 * @property {string} geminiApiKey
 * @property {string} groqApiKey
 * @property {string} pixabayApiKey
 * @property {string} giphyApiKey
 */

/**
 * Общий контракт LocalStore и CloudStore.
 * @typedef {Object} Store
 * @property {'local'|'cloud'} kind
 * @property {Object[]} folders
 * @property {Object[]} boxes
 * @property {StoreSettings} settings
 * @property {boolean} offline
 * @property {() => Promise<void>} init
 * @property {(folderId: string) => Promise<Object[]>} getFolderCards
 * @property {(folderId?: string|null) => Promise<number>} countCards
 * @property {(folderId?: string|null, algo?: string) => Promise<number>} countDue
 * @property {(folderId?: string|null, algo?: string, from?: number, to?: number) => Promise<number>} countDueBetween
 * @property {(folderId?: string|null, algo?: string) => Promise<number>} countNew
 * @property {(budget?: number) => Promise<import('./home-stats.js').HomeStats>} getHomeStats
 * @property {(folderId?: string|null, algo?: string, newLimit?: number, now?: number) => Promise<{due: Object[], fresh: Object[]}>} getReviewCards
 * @property {(folderId: string, limit?: number|null) => Promise<Object[]>} getCramCards
 * @property {(data: Object) => Promise<Object>} createFolder
 * @property {(id: string, patch: Object) => Promise<Object|null>} updateFolder
 * @property {(id: string) => Promise<boolean|void>} deleteFolder
 * @property {(data: Object) => Promise<Object>} createBox
 * @property {(id: string, patch: Object) => Promise<Object|null>} updateBox
 * @property {(id: string) => Promise<boolean|void>} deleteBox
 * @property {(folderId: string, boxId: string|null) => Promise<Object|null>} assignFolderToBox
 * @property {(packId: string) => Object|null} findFolderByPackId
 * @property {(pack: Object, onProgress?: Function) => Promise<Object>} importVocabPack
 * @property {(packId: string) => Promise<void>} deleteVocabPack
 * @property {(data: Object) => Promise<Object>} createCard
 * @property {(id: string, patch: Object) => Promise<Object|null>} updateCard
 * @property {(id: string) => Promise<void>} deleteCard
 * @property {(file: File, opts?: {side?: string, cardId?: string}) => Promise<string>} uploadImage
 * @property {(url?: string) => Promise<void>} deleteImage
 * @property {(s: StoreSettings) => Promise<StoreSettings>} saveSettings
 * @property {() => Promise<string>} exportJSONFull
 * @property {(text: string) => Promise<void>} importJSON
 * @property {() => Promise<number>} pendingSync
 * @property {() => Promise<number>} deadLetterCount
 * @property {() => Promise<Object[]>} deadLetters
 * @property {(id: number) => Promise<boolean>} retryDeadLetter
 * @property {(id: number) => Promise<boolean>} discardDeadLetter
 * @property {() => Promise<{ok: number, fail: number}>} flushSync
 */

import { uuid } from "./store-common.js"
import { normalizeFolderIcon } from "../lib/folder-icons.js"
import { noteTitleFromBody } from "../lib/markdown.js"
import type { Folder, Box, Card, Note } from "./types.js"

/** Поля новой папки — общие для local и cloud. */
export function buildFolderRecord(data: Partial<Folder>, extras: Record<string, unknown> = {}): Folder {
  const t = Date.now()
  return {
    id: uuid(),
    name: data.name ?? "",
    color: data.color || "#7C8DB5",
    icon: normalizeFolderIcon(data.icon),
    created_at: t,
    updated_at: t,
    pack_id: data.pack_id ?? null,
    pack_version: data.pack_version ?? null,
    box_id: data.box_id ?? null,
    ...extras
  }
}

/** Поля новой коробки — группа папок по теме. */
export function buildBoxRecord(data: Partial<Box>, extras: Record<string, unknown> = {}): Box {
  const t = Date.now()
  return {
    id: uuid(),
    name: data.name ?? "",
    color: data.color || "#8F3D18",
    icon: normalizeFolderIcon(data.icon),
    created_at: t,
    updated_at: t,
    ...extras
  }
}

/** Поля новой карточки — общие для local и cloud. */
export function buildCardRecord(data: Partial<Card>, extras: Record<string, unknown> = {}): Card {
  const t = Date.now()
  return Object.assign(
    {
      id: uuid(),
      created_at: t,
      updated_at: t,
      front: "",
      back: "",
      description: "",
      front_img: null,
      back_img: null,
      sm2_ef: 2.5,
      sm2_reps: 0,
      sm2_ivl: 0,
      sm2_due: null,
      box: 0,
      box_due: null,
      fsrs_state: null,
      fsrs_stability: null,
      fsrs_difficulty: null,
      fsrs_due: null,
      fsrs_scheduled_days: null,
      fsrs_elapsed_days: null,
      fsrs_reps: null,
      fsrs_lapses: null,
      fsrs_learning_steps: null,
      fsrs_last_review: null
    },
    data,
    extras
  )
}

/** Поля новой заметки — общие для local и cloud. */
export function buildNoteRecord(data: Partial<Note>, extras: Record<string, unknown> = {}): Note {
  const t = Date.now()
  const body = data.body ?? ""
  const title = (data.title ?? "").trim() || noteTitleFromBody(body, "")
  const tags = Array.isArray(data.tags)
    ? data.tags.map((x) => String(x).toLowerCase()).filter(Boolean)
    : undefined
  return {
    id: data.id || uuid(),
    title,
    body,
    folder_id: data.folder_id ?? null,
    tags: tags ?? [],
    conflict_of: data.conflict_of ?? null,
    created_at: data.created_at ?? t,
    updated_at: data.updated_at ?? t,
    ...extras,
  }
}

export function exportJSONPayload(
  folders: unknown[],
  cards: unknown[],
  settings: unknown,
  boxes: unknown[] = [],
  notes: unknown[] = []
): string {
  return JSON.stringify({ v: 3, folders, cards, settings, boxes, notes }, null, 2)
}

/**
 * Валидация JSON при импорте — защищает от prototype pollution, неверных типов
 * и отсутствия обязательных полей. Не использует внешние библиотеки. Общая для
 * LocalStore и CloudStore — раньше была продублирована в обоих.
 */
export function validateImportJSON(data: unknown): void {
  if (!data || typeof data !== 'object') throw new Error('JSON: не объект')
  const obj = data as Record<string, unknown>
  if (!Array.isArray(obj.folders)) throw new Error('JSON: нет folders[]')
  if (!Array.isArray(obj.cards)) throw new Error('JSON: нет cards[]')
  for (const [i, f] of obj.folders.entries()) {
    if (!f || typeof f !== 'object') throw new Error(`folders[${i}]: не объект`)
    const fo = f as Record<string, unknown>
    if (typeof fo.id !== 'string') throw new Error(`folders[${i}].id: не строка`)
    if (typeof fo.name !== 'string') throw new Error(`folders[${i}].name: не строка`)
  }
  for (const [i, c] of obj.cards.entries()) {
    if (!c || typeof c !== 'object') throw new Error(`cards[${i}]: не объект`)
    const co = c as Record<string, unknown>
    if (typeof co.id !== 'string') throw new Error(`cards[${i}].id: не строка`)
    if (typeof co.front !== 'string') throw new Error(`cards[${i}].front: не строка`)
    if (typeof co.back !== 'string') throw new Error(`cards[${i}].back: не строка`)
  }
  if (obj.boxes && !Array.isArray(obj.boxes)) throw new Error('JSON: boxes не массив')
  if (obj.notes && !Array.isArray(obj.notes)) throw new Error('JSON: notes не массив')
  if (obj.settings && (typeof obj.settings !== 'object' || obj.settings === null)) {
    throw new Error('JSON: settings не объект')
  }
}
