/**
 * @typedef {Object} StoreSettings
 * @property {'sm2'|'leitner'|'fsrs'} algo
 * @property {'ftb'|'btf'|'mix'} direction
 * @property {number} newPerDay
 * @property {number[]} leitnerIntervals
 * @property {boolean} tts
 * @property {number} ttsRate
 * @property {boolean} ttsAuto
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
 * @property {(folderId?: string|null, algo?: string, newLimit?: number, now?: number) => Promise<{due: Object[], fresh: Object[]}>} getReviewCards
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
 * @property {(file: File) => Promise<string>} uploadImage
 * @property {(url?: string) => Promise<void>} deleteImage
 * @property {(s: StoreSettings) => Promise<StoreSettings>} saveSettings
 * @property {() => Promise<string>} exportJSONFull
 * @property {(text: string) => Promise<void>} importJSON
 * @property {() => Promise<number>} pendingSync
 * @property {() => Promise<{ok: number, fail: number}>} flushSync
 * @property {() => {offline: boolean, deadLetterCount: number}} syncHealth Синхронный снимок для баннеров.
 * @property {() => Promise<Object[]>} deadLetters Операции, которые не удалось отправить (не сетевая ошибка).
 * @property {(id: number) => Promise<boolean>} retryDeadLetterSync Вернуть операцию обратно в очередь.
 * @property {(id: number) => Promise<void>} discardDeadLetterSync Отменить операцию навсегда.
 */

import { uuid } from './store-common.js';
import { normalizeFolderIcon } from '../lib/folder-icons.js';

/** Поля новой папки — общие для local и cloud. */
export function buildFolderRecord(data, extras = {}) {
  const now = Date.now();
  return {
    id: uuid(),
    name: data.name,
    color: data.color || '#7C8DB5',
    icon: normalizeFolderIcon(data.icon),
    created_at: now,
    updated_at: now,
    pack_id: data.pack_id || null,
    pack_version: data.pack_version ?? null,
    box_id: data.box_id || null,
    ...extras,
  };
}

/** Поля новой коробки — группа папок по теме. */
export function buildBoxRecord(data, extras = {}) {
  const now = Date.now();
  return {
    id: uuid(),
    name: data.name,
    color: data.color || '#8F3D18',
    icon: normalizeFolderIcon(data.icon),
    created_at: now,
    updated_at: now,
    ...extras,
  };
}

/** Поля новой карточки — общие для local и cloud. */
export function buildCardRecord(data, extras = {}) {
  const now = Date.now();
  return Object.assign({
    id: uuid(),
    created_at: now,
    updated_at: now,
    front: '',
    back: '',
    description: '',
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
    fsrs_last_review: null,
  }, data, extras);
}

export function exportJSONPayload(folders, cards, settings, boxes = []) {
  return JSON.stringify({ v: 2, folders, cards, settings, boxes }, null, 2);
}
