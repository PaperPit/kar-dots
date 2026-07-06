import { initConfig, cloudConfigured, setSb, setStore, sb, cfg } from './core/state.js';
import { toast } from './ui/ui.js';
import { MiniSupabase } from './data/supabase.js';
import { CloudStore } from './data/index.js';
import { renderAuth, enterLocal } from './screens/auth/index.js';
import { initActivity } from './lib/activity.js';
import { initUiClicks } from './lib/ui-clicks.js';
import { initRouter, route } from './core/router.js';
import { initMotionUi, animateBootSplashOut } from './lib/motion-ui.js';

function dismissBootSplash() {
  animateBootSplashOut(document.getElementById('bootSplash'));
}

async function boot() {
  initMotionUi();
  await initConfig();
  await initActivity();

  if (cloudConfigured) {
    setSb(new MiniSupabase(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY));
  }

  initRouter();
  initUiClicks();
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
    dismissBootSplash();
    toast('Ошибка запуска: ' + e.message, 'error');
    renderAuth();
  }
}

boot().catch(e => {
  console.error('Boot failed:', e);
  dismissBootSplash();
  document.getElementById('app').innerHTML =
    '<main class="main"><div class="auth-wrap"><p class="auth-note">Не удалось запустить приложение. Откройте консоль браузера (F12) для деталей.</p></div></main>';
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
