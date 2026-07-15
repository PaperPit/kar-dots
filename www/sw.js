const VERSION = 'kar-v13.5';

/** AUTO-GENERATED CORE_FILES — node scripts/generate-sw-files.js */
const CORE_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'css/components/modal.css',
  'css/screens/home.css',
  'css/screens/folder.css',
  'css/screens/card-editor.css',
  'css/screens/review.css',
  'css/screens/settings.css',
  'css/fonts/fonts.css',
  'css/fonts/baloo2-latin.woff2',
  'css/fonts/nunito-cyr-ext.woff2',
  'css/fonts/nunito-cyr.woff2',
  'css/fonts/nunito-latin-ext.woff2',
  'css/fonts/nunito-latin.woff2',
  'packs/manifest.json',
  'js/app.js',
  'js/config.example.js',
  'js/core/router.js',
  'js/core/state.js',
  'js/core/version.js',
  'js/data/index.js',
  'js/data/schema-version.js',
  'js/data/srs-meta.js',
  'js/data/srs-query.js',
  'js/data/store-box.js',
  'js/data/store-cache.js',
  'js/data/store-cloud.js',
  'js/data/store-common.js',
  'js/data/store-contract.js',
  'js/data/store-local.js',
  'js/data/store-vocab.js',
  'js/data/supabase.js',
  'js/data/sync-queue.js',
  'js/data/tts-cache.js',
  'js/lib/activity.js',
  'js/lib/answer-check.js',
  'js/lib/card-import.js',
  'js/lib/cloze.js',
  'js/lib/folder-errors.js',
  'js/lib/folder-icons.js',
  'js/lib/fsrs-engine.js',
  'js/lib/gemini-generate.js',
  'js/lib/groq-generate.js',
  'js/lib/image-utils.js',
  'js/lib/lesson-stars.js',
  'js/lib/llm-api-keys.js',
  'js/lib/motion-ui.js',
  'js/lib/orpheus-tts.js',
  'js/lib/raven-easter-egg.js',
  'js/lib/review-progress.js',
  'js/lib/shuffle.js',
  'js/lib/sounds.js',
  'js/lib/speech-input.js',
  'js/lib/srs.js',
  'js/lib/stats.js',
  'js/lib/stock-media-providers.js',
  'js/lib/stock-media-settings.js',
  'js/lib/stock-media.js',
  'js/lib/study-keyboard.js',
  'js/lib/study-modes.js',
  'js/lib/theme.js',
  'js/lib/time-units.js',
  'js/lib/translate.js',
  'js/lib/ui-clicks.js',
  'js/lib/virtual-list.js',
  'js/lib/vocab-packs.js',
  'js/lib/voice-keyboard.js',
  'js/lib/web-speech-tts.js',
  'js/lib/youtube-import-settings.js',
  'js/lib/youtube-import.js',
  'js/screens/auth/index.js',
  'js/screens/box/index.js',
  'js/screens/card-editor/actions.js',
  'js/screens/card-editor/bulk-dialog.js',
  'js/screens/card-editor/card-preview.js',
  'js/screens/card-editor/form.js',
  'js/screens/card-editor/image-drop.js',
  'js/screens/card-editor/index.js',
  'js/screens/card-editor/stock-image-picker.js',
  'js/screens/folder/index.js',
  'js/screens/folder/youtube-dialog.js',
  'js/screens/home/box-dialog.js',
  'js/screens/home/folder-dialog.js',
  'js/screens/home/index.js',
  'js/screens/review/flip-card.js',
  'js/screens/review/grading.js',
  'js/screens/review/index.js',
  'js/screens/review/mode-picker.js',
  'js/screens/review/modes/cloze.js',
  'js/screens/review/modes/flip.js',
  'js/screens/review/modes/match.js',
  'js/screens/review/modes/type.js',
  'js/screens/review/modes/voice.js',
  'js/screens/review/session.js',
  'js/screens/settings/index.js',
  'js/screens/settings/sections/account.js',
  'js/screens/settings/sections/algo.js',
  'js/screens/settings/sections/calendar.js',
  'js/screens/settings/sections/data.js',
  'js/screens/settings/sections/integrations.js',
  'js/screens/settings/sections/packs.js',
  'js/screens/settings/sections/sounds.js',
  'js/screens/settings/sections/stats.js',
  'js/screens/settings/sections/stock-media.js',
  'js/screens/settings/shared.js',
  'js/ui/activity-calendar.js',
  'js/ui/answer-feedback.js',
  'js/ui/brand.js',
  'js/ui/card-face.js',
  'js/ui/constants.js',
  'js/ui/folder-cards.js',
  'js/ui/folder-drag.js',
  'js/ui/helpers.js',
  'js/ui/icon-picker.js',
  'js/ui/icons.js',
  'js/ui/melody-picker.js',
  'js/ui/navigation.js',
  'js/ui/raven-brand.js',
  'js/ui/rich-editor.js',
  'js/ui/shell.js',
  'js/ui/study-budget.js',
  'js/ui/swipe-grades.js',
  'js/ui/theme-toggle.js',
  'js/ui/translate-dir-toggle.js',
  'js/ui/tts.js',
  'js/ui/ui.js',
  'js/ui/vocab-packs-dialog.js',
  'js/vendor/capacitor-speech-recognition.mjs',
  'js/vendor/motion.mjs',
  'js/vendor/ts-fsrs.mjs',
  'icons/Bird cage.svg',
  'icons/Scarecrow.svg',
  'icons/The crow with the tombstone.svg',
  'icons/app-icon.svg',
  'icons/apple-touch-icon.png',
  'icons/cup.svg',
  'icons/empty cage.svg',
  'icons/feather.svg',
  'icons/ghost.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'icons/logo.svg',
  'icons/raven.svg',
  'icons/star.png',
  'icons/star.svg',
  'icons/folders/align-justify.png',
  'icons/folders/bookmark.png',
  'icons/folders/books.png',
  'icons/folders/box-alt.png',
  'icons/folders/box-open.png',
  'icons/folders/bulb.png',
  'icons/folders/dollar.png',
  'icons/folders/edit.png',
  'icons/folders/globe.png',
  'icons/folders/graduation-cap.png',
  'icons/folders/leaf.png',
  'icons/folders/pencil.png',
  'icons/folders/restaurant.png',
  'icons/folders/rocket.png',
  'icons/folders/search.png',
  'icons/folders/stats.png',
  'icons/folders/stethoscope.png',
];

/** Кэшируются при первом обращении (офлайн после первого использования). */
const LAZY_PREFIXES = ['audio/', 'packs/en-'];

function isLazyPath(pathname) {
  return LAZY_PREFIXES.some(p => pathname.includes(p));
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isStorageImage = url.pathname.includes('/storage/v1/object/public/');
  const isSameOrigin = url.origin === location.origin;
  if (!isSameOrigin && !isStorageImage) return;

  const path = url.pathname.replace(/^\//, '');
  const isAppJs = isSameOrigin && /\.(js|css|html)$/.test(url.pathname);
  const lazy = isSameOrigin && isLazyPath(path);

  e.respondWith(
    fetch(isAppJs ? new Request(e.request, { cache: 'no-cache' }) : e.request)
      .then(resp => {
        const hasRange = e.request.headers.has('range');
        if (resp.status === 200 && !hasRange) {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(async () => {
        const cached = await caches.match(e.request, { ignoreSearch: isSameOrigin });
        if (cached) return cached;
        if (lazy) throw new Error('offline');
        return caches.match(e.request, { ignoreSearch: isSameOrigin });
      }),
  );
});
