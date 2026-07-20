import { initTheme } from './lib/theme.js';
import { initMotionUi, animateBootSplashOut } from './lib/motion-ui.js';
import { initConfig, cloudConfigured, setSb, setStore, sb, cfg } from './core/state.js';
import { toast } from './ui/ui.js';
import { MiniSupabase } from './data/supabase.js';
import { renderAuth, enterLocal, attachCloudDataReload } from './screens/auth/index.js';
import { initActivity } from './lib/activity.js';
import { initUiClicks } from './lib/ui-clicks.js';
import { initRouter, route } from './core/router.js';
import { initSpeechVoices } from './lib/web-speech-tts.js';
import { initStudyKeyboardLock } from './lib/study-keyboard.js';

function dismissBootSplash() {
  animateBootSplashOut(document.getElementById('bootSplash') as HTMLElement);
}

async function boot() {
  initTheme();
  initMotionUi();
  await initConfig();
  await initActivity();

  if (cloudConfigured) {
    const url = cfg.SUPABASE_URL;
    const key = cfg.SUPABASE_ANON_KEY;
    if (url !== undefined && key !== undefined) {
      setSb(new MiniSupabase(url, key));
    }
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
      attachCloudDataReload(cloud);
      // Пустое зеркало при старте: дождаться облака, иначе первый кадр — «Пока пусто».
      if (navigator.onLine && !cloud.folders.length && !cloud.boxes.length) {
        await cloud.whenCloudReady();
      }
      // Отправить локальную статистику дня в облако (и забрать чужую), пока splash ещё виден.
      if (navigator.onLine) {
        await cloud.whenCloudReady();
        await cloud.syncActivityNow();
      }
      await route();
    } else {
      dismissBootSplash();
      renderAuth(undefined);
    }
  } catch (e) {
    console.error(e);
    dismissBootSplash();
    toast('Ошибка запуска: ' + (e instanceof Error ? e.message : String(e)), 'error');
    renderAuth(undefined);
  }
}

boot().catch(e => {
  console.error('Boot failed:', e);
  dismissBootSplash();
  (document.getElementById('app') as HTMLElement).innerHTML =
    '<main class="main"><div class="auth-wrap"><p class="auth-note">Не удалось запустить приложение. Откройте консоль браузера (F12) для деталей.</p></div></main>';
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.info('[kar] service worker зарегистрирован — офлайн-кэш активен'))
    .catch((err) => console.warn('[kar] регистрация service worker не удалась:', err));
}
