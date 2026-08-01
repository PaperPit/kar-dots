import type { MiniSupabase } from "../data/supabase.js";
import type { Folder, Box, Card } from "../data/types.js";
import type { HomeStats } from "../data/home-stats.js";
import type { SrsRow, Algo } from "../lib/srs.js";

/**
 * Общий контракт LocalStore и CloudStore — ровно те члены, которыми пользуются
 * ui/ и screens/. Канонический список лежит в `js/data/store-contract.ts`
 * (JSDoc `@typedef Store`), но он не типизирован для TS, а править data/ нельзя,
 * поэтому интерфейс объявлен здесь и только для типов: ни одна из реализаций
 * его не `implements`, он лишь описывает переменную `store`.
 *
 * Сигнатуры намеренно шире реализаций там, где вызовы в UI короче (например,
 * `countDue(folderId)` без алгоритма) — иначе типизация ломала бы рабочий код.
 * Полезная часть — имена членов и типы результатов: опечатка в `store.*` и
 * неверное обращение к результату теперь ошибка компиляции, а не пустой экран.
 */
export interface AppStore {
  /** 'local' | 'cloud'; в классах поле объявлено как string. */
  kind: string;
  /** Облако недоступно (у LocalStore всегда false). */
  readonly offline: boolean;
  folders: Folder[];
  boxes: Box[];
  /**
   * settings намеренно any: в приложении два несовместимых типа Settings —
   * `data/types` и `lib/sounds` (у них расходится `answerSoundMode`), а
   * `lib/sounds` читает `store.settings` напрямую. Сузить можно только вместе
   * с унификацией Settings, а `lib/sounds.ts` правит другой владелец.
   */
  settings: any;

  init(): Promise<void>;

  // —— чтение ——
  /**
   * Промис намеренно `any`, а не `Card[]`: обе реализации возвращают ещё и
   * `undefined` (значение из кеша папок), так что точный тип потребовал бы
   * правки в data/ — см. `store-local.getFolderCards` / `store-cloud`.
   */
  getFolderCards(folderId: string): Promise<any>;
  countCards(folderId?: string | null): Promise<number>;
  countDue(folderId?: string | null, algo?: Algo): Promise<number>;
  countDueBetween(folderId?: string | null, algo?: Algo, from?: number, to?: number): Promise<number>;
  countNew(folderId?: string | null, algo?: Algo): Promise<number>;
  getHomeStats(): Promise<HomeStats>;
  getAllSrsRows(): SrsRow[];
  /** Онлайн-ветка CloudStore отдаёт сырые строки Supabase — отсюда any[]. */
  getReviewCards(
    folderId: string | null,
    algo: Algo,
    newLimit: number,
    now: number
  ): Promise<{ due: any[]; fresh: any[] }>;
  getCramCards(folderId: string | null, limit: number | null): Promise<Card[]>;
  scanFolderFronts(folderId: string | null, opts?: { youtubeOnly?: boolean }): Promise<{ front: string }[]>;

  // —— папки и коробки ——
  // Пишущие методы CloudStore проходят через `_cloudOrQueue`, а он объявлен как
  // `Promise<unknown>`: пока это не исправлено в data/, точные типы результата
  // сделали бы CloudStore несовместимым с этим интерфейсом.
  createFolder(data: any): Promise<any>;
  updateFolder(id: string, patch: any): Promise<any>;
  deleteFolder(id: string): Promise<unknown>;
  createBox(data: any): Promise<any>;
  updateBox(id: string, patch: any): Promise<any>;
  deleteBox(id: string): Promise<unknown>;
  assignFolderToBox(folderId: string, boxId?: string | null): Promise<any>;
  setBoxFolders(boxId: string, folderIds: string[]): Promise<unknown>;

  // —— лексические паки ——
  findFolderByPackId(packId: string): Folder | null | undefined;
  importVocabPack(pack: any, onProgress?: (info: any) => void): Promise<Folder>;
  deleteVocabPack(packId: string): Promise<unknown>;

  // —— карточки ——
  createCard(data: any): Promise<any>;
  updateCard(id: string, patch: any): Promise<any>;
  deleteCard(id: string): Promise<unknown>;
  uploadImage(file: Blob, opts?: { side?: string; cardId?: string }): Promise<string>;
  deleteImage(url?: string): Promise<unknown>;

  // —— настройки и обмен данными ——
  saveSettings(s: any): Promise<any>;
  exportJSONFull(): Promise<string>;
  importJSON(text: string): Promise<unknown>;

  // —— синхронизация ——
  pendingSync(): Promise<number>;
  deadLetterCount(): Promise<number>;
  deadLetters(): Promise<any[]>;
  retryDeadLetter(id: number): Promise<boolean>;
  discardDeadLetter(id: number): Promise<boolean>;
  flushSync(): Promise<{ ok: number; fail: number }>;
  /** Сбросить кеш домашней статистики (внутренний, но экраны его дёргают). */
  _invalidateHomeStats(): void;
  /** Только у CloudStore — вызовы прикрыты проверкой typeof. */
  onSyncChange?(fn: (state: any) => void): void;
  /** Только у CloudStore. */
  syncReviewLogFromCloud?(): Promise<number>;
  /** Только у CloudStore: устаревшая schema_meta → текст баннера. */
  schemaWarning?: string | null;
}

export interface Config {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  [key: string]: unknown;
}

let cfg = {} as Config;
let cloudConfigured = false;

// store появляется только после boot (LocalStore или CloudStore), но объявлен
// non-nullable: экраны рисуются уже после инициализации, а строгая проверка на
// null здесь означала бы сотни фиктивных `store!` по всему UI. До boot чтение
// store всё равно падало бы — теперь просто без подсказки компилятора.
let store: AppStore = null as unknown as AppStore;
let sb: MiniSupabase | null = null;

// Модуль импортируется и из чистых утилит (js/lib), поэтому обращение к DOM на
// верхнем уровне обёрнуто проверкой: без неё простой импорт падал в среде без
// document (Node, тесты без happy-dom).
export const app =
  typeof document !== 'undefined'
    ? (document.getElementById('app') as HTMLElement)
    : (null as unknown as HTMLElement);

/** Загружает config.js или config.example.js (на хостинге config.js часто отсутствует). */
export async function initConfig(): Promise<void> {
  cfg = {} as Config;
  for (const path of ['../config.js', '../config.example.js']) {
    try {
      const mod = await import(path);
      if (mod.default && typeof mod.default === 'object') {
        cfg = mod.default;
        break;
      }
    } catch (e) {
      /* пробуем следующий файл */
    }
  }
  cloudConfigured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
}

/** null означает «вышли из аккаунта»; см. комментарий у объявления store. */
export function setStore(s: AppStore | null): void {
  store = s as AppStore;
}
export function setSb(s: MiniSupabase | null): void {
  sb = s;
}

export { store, sb, cloudConfigured, cfg }; // For individual imports
