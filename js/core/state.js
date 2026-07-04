export let cfg = {};
export let cloudConfigured = false;

export let store = null;
export let sb = null;

export const app = document.getElementById('app');

/** Загружает config.js или config.example.js (на хостинге config.js часто отсутствует). */
export async function initConfig() {
  cfg = {};
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

export function setStore(s) { store = s; }
export function setSb(s) { sb = s; }
