import { initTheme } from './lib/theme.js';
import { initMotionUi, animateBootSplashOut } from './ui/motion-lazy.js';
import { initConfig, cloudConfigured, setSb, setStore, sb, cfg } from './core/state.js';
import { toast } from './ui/ui.js';
import { MiniSupabase } from './data/supabase.js';
import { renderAuth, enterLocal, attachCloudDataReload } from './screens/auth/index.js';
import { initActivity } from './lib/activity.js';
import { initUiClicks } from './lib/ui-clicks.js';
import { initRouter, route } from './core/router.js';
import { initSpeechVoices } from './lib/web-speech-tts.js';
import { initStudyKeyboardLock } from './lib/study-keyboard.js';
import { initExtConnect } from './lib/ext-connect.js';
import { applyUiLocale, t } from './lib/i18n.js';
import { initGlobalErrors } from './ui/global-errors.js';

function dismissBootSplash() {
  animateBootSplashOut(document.getElementById('bootSplash') as HTMLElement);
}

async function boot() {
  // Первым делом — сетка безопасности: всё, что упадёт ниже, будет видно.
  initGlobalErrors();
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
      applyUiLocale(cloud.settings.language);
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
      initExtConnect();
    } else {
      dismissBootSplash();
      renderAuth(undefined);
      initExtConnect();
    }
  } catch (e) {
    console.error(e);
    dismissBootSplash();
    toast(t('app.bootError', { message: e instanceof Error ? e.message : String(e) }), 'error');
    renderAuth(undefined);
    initExtConnect();
  }
}

boot().catch(e => {
  console.error('Boot failed:', e);
  dismissBootSplash();
  (document.getElementById('app') as HTMLElement).innerHTML =
    '<main class="main"><div class="auth-wrap"><p class="auth-note"></p></div></main>';
  const note = document.querySelector('#app .auth-note');
  if (note) note.textContent = t('app.bootFailed');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.info('[kar] service worker зарегистрирован — офлайн-кэш активен'))
    .catch((err) => console.warn('[kar] регистрация service worker не удалась:', err));
}
