import { initConfig, cloudConfigured, setSb, setStore, sb, cfg } from './core/state.js';
import { toast } from './ui/ui.js';
import { MiniSupabase } from './data/supabase.js';
import { renderAuth, enterLocal } from './screens/auth/index.js';
import { initActivity } from './lib/activity.js';
import { initUiClicks } from './lib/ui-clicks.js';
import { initRouter, route, parseHash } from './core/router.js';
import { initMotionUi, animateBootSplashOut } from './lib/motion-ui.js';
import { initSpeechVoices } from './lib/web-speech-tts.js';
import { initTheme } from './lib/theme.js';
import { initStudyKeyboardLock } from './lib/study-keyboard.js';

function dismissBootSplash() {
  animateBootSplashOut(document.getElementById('bootSplash'));
}

async function boot() {
  initTheme();
  initMotionUi();
  await initConfig();
  await initActivity();

  if (cloudConfigured) {
    setSb(new MiniSupabase(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY));
  }

  initRouter();
  initUiClicks();
  initSpeechVoices();
  initStudyKeyboardLock();
  const mode = localStorage.getItem('kar_mode');

  try {
    if (mode === 'local') {
      await enterLocal();
    } else if (mode === 'cloud' && sb && sb.hasSession()) {
      const { CloudStore } = await import('./data/store-cloud.js');
      const cloud = new CloudStore(sb);
      await cloud.init();
      setStore(cloud);
      // Фоновая догрузка из облака перерисует экран — но не во время сессии повторения.
      cloud.onDataChange(() => {
        if (parseHash(location.hash).name === 'review') return;
        route();
      });
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
  navigator.serviceWorker.register('sw.js')
    .then(() => console.info('[kar] service worker зарегистрирован — офлайн-кэш активен'))
    .catch((err) => console.warn('[kar] регистрация service worker не удалась:', err));
}
