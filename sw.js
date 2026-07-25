const VERSION = 'kar-v15.4';

/** AUTO-GENERATED CORE_FILES — node scripts/generate-sw-files.js */
const CORE_FILES = [
  './',
  'css/components/modal.css',
  'css/fonts/baloo2-latin.woff2',
  'css/fonts/fonts.css',
  'css/fonts/nunito-cyr-ext.woff2',
  'css/fonts/nunito-cyr.woff2',
  'css/fonts/nunito-latin-ext.woff2',
  'css/fonts/nunito-latin.woff2',
  'css/screens/card-editor.css',
  'css/screens/folder.css',
  'css/screens/home.css',
  'css/screens/review.css',
  'css/screens/settings.css',
  'css/screens/stats.css',
  'css/screens/youtube-import.css',
  'css/style.css',
  'icons/app-icon.svg',
  'icons/apple-touch-icon.png',
  'icons/Bird cage.svg',
  'icons/cup.svg',
  'icons/empty cage.svg',
  'icons/feather.svg',
  'icons/ghost.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'icons/logo.svg',
  'icons/raven.svg',
  'icons/Scarecrow.svg',
  'icons/star.png',
  'icons/star.svg',
  'icons/The crow with the tombstone.svg',
  'index.html',
  'js/app.js',
  'js/core/router.js',
  'js/core/state.js',
  'js/core/state.reexport.js',
  'js/core/version.js',
  'js/data/cache-invalidate.js',
  'js/data/card-hydrate.js',
  'js/data/cloud-delta.js',
  'js/data/home-stats.js',
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
  'js/data/types.js',
  'js/data/yt-transcript-cache.js',
  'js/lib/activity.js',
  'js/lib/answer-check.js',
  'js/lib/card-import.js',
  'js/lib/card-search.js',
  'js/lib/charts.js',
  'js/lib/debounce.js',
  'js/lib/ext-connect.js',
  'js/lib/folder-errors.js',
  'js/lib/folder-icons.js',
  'js/lib/fsrs-optimize.js',
  'js/lib/gemini-generate.js',
  'js/lib/groq-generate.js',
  'js/lib/image-utils.js',
  'js/lib/lesson-stars.js',
  'js/lib/llm-api-keys.js',
  'js/lib/motion-ui.js',
  'js/lib/orpheus-tts.js',
  'js/lib/raven-easter-egg.js',
  'js/lib/review-log.js',
  'js/lib/review-progress.js',
  'js/lib/shuffle.js',
  'js/lib/sounds.js',
  'js/lib/srs-convert.js',
  'js/lib/srs.js',
  'js/lib/stats.js',
  'js/lib/stock-media-providers.js',
  'js/lib/stock-media-settings.js',
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
  'js/lib/yt-caption-parsers.js',
  'js/lib/yt-job-owner.js',
  'js/lib/yt-known-terms-idb.js',
  'js/lib/yt-known-terms.js',
  'js/lib/yt-segment-merge.js',
  'js/lib/yt-transcript.js',
  'js/ui/activity-calendar.js',
  'js/ui/answer-feedback.js',
  'js/ui/brand.js',
  'js/ui/card-face.js',
  'js/ui/constants.js',
  'js/ui/ensure-css.js',
  'js/ui/folder-cards.js',
  'js/ui/folder-drag.js',
  'js/ui/helpers.js',
  'js/ui/home-day-card.js',
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
  'js/ui/types.js',
  'js/ui/ui.js',
  'js/ui/vocab-packs-dialog.js',
  'js/vendor/motion.mjs',
  'manifest.webmanifest',
  'packs/manifest.json',
];

/** Кэшируются при первом обращении (офлайн после первого использования). */
const LAZY_PREFIXES = [
  'audio/',
  'packs/en-',
  'js/screens/',
  'js/vendor/capacitor-speech-recognition.mjs',
  'js/vendor/ts-fsrs.mjs',
  'js/lib/fsrs-engine.js',
  'js/lib/speech-input.js',
  'js/lib/stock-media.js',
  'js/lib/cloze.js',
  'icons/folders/',
];

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
  const lazy = isSameOrigin && isLazyPath(path);
  const hasRange = e.request.headers.has('range');
  const hashedChunk = isSameOrigin && /\/[A-Za-z0-9_-]+-[A-Z0-9]{8}\.js$/.test(url.pathname);
  const shellAsset = isSameOrigin && /\.(js|css|html)$/.test(url.pathname) && !hashedChunk;

  function putInCache(req, resp) {
    if (resp.status === 200 && !hasRange) {
      const copy = resp.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
    }
  }

  if (hashedChunk) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          putInCache(e.request, resp);
          return resp;
        });
      }).catch(async () => {
        const cached = await caches.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        if (lazy) throw new Error('offline');
        throw new Error('offline');
      }),
    );
    return;
  }

  if (shellAsset) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        const network = fetch(e.request)
          .then(resp => {
            putInCache(e.request, resp);
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        putInCache(e.request, resp);
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
