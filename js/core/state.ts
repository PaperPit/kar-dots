import type { MiniSupabase } from "../data/supabase.js";
import type { LocalStore } from "../data/store-local.js";
import type { CloudStore } from "../data/store-cloud.js";

export interface Config {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  [key: string]: unknown;
}

export type AppStore = LocalStore | CloudStore;

let cfg = {} as Config;
let cloudConfigured = false;

/**
 * After boot / enterLocal / cloud init the router only mounts screens when a store is set.
 * Typed as AppStore (not any) so settings/folders/methods stay checked; null only before boot.
 */
let store = null as unknown as AppStore;
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

export function setStore(s: AppStore | null): void {
  store = s as AppStore;
}
export function setSb(s: MiniSupabase | null): void {
  sb = s;
}

export { store, sb, cloudConfigured, cfg };
