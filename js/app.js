import KAR_CONFIG from '../config.js';
import { cloudConfigured, setSb, setStore, sb } from './core/state.js';
import { toast } from './ui/ui.js';
import { MiniSupabase } from './data/supabase.js';
import { CloudStore } from './data/index.js';
import { renderAuth, enterLocal } from './screens/auth/index.js';
import { initRouter, route } from './core/router.js';

async function boot() {
  if (cloudConfigured) {
    setSb(new MiniSupabase(KAR_CONFIG.SUPABASE_URL, KAR_CONFIG.SUPABASE_ANON_KEY));
  }

  initRouter();
  const mode = localStorage.getItem('kar_mode');

  try {
    if (mode === 'local') {
      await enterLocal();
    } else if (mode === 'cloud' && sb && await sb.ensureFresh()) {
      const cloud = new CloudStore(sb);
      await cloud.init();
      setStore(cloud);
      await route();
    } else {
      renderAuth();
    }
  } catch (e) {
    console.error(e);
    toast('Ошибка запуска: ' + e.message, 'error');
    renderAuth();
  }
}

boot();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
