import type { MiniSupabase } from "../data/supabase.js";

export interface Config {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  [key: string]: unknown;
}

let cfg = {} as Config;
let cloudConfigured = false;

// store намеренно any: в приложении два конфликтующих типа Settings
// (data/types и lib/sounds), поэтому точная типизация LocalStore | CloudStore
// ломает звуковые хелперы. Типизировать после унификации Settings.
let store: any = null;
let sb: MiniSupabase | null = null;

export const app = document.getElementById('app') as HTMLElement;

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

export function setStore(s: any): void {
  store = s;
}
export function setSb(s: MiniSupabase | null): void {
  sb = s;
}

export { store, sb, cloudConfigured, cfg }; // For individual imports
