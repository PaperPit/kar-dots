const VERSION = 'kar-v7.14';
const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'css/fonts/fonts.css',
  'css/fonts/baloo2-deva.woff2', 'css/fonts/baloo2-viet.woff2',
  'css/fonts/baloo2-ext.woff2', 'css/fonts/baloo2-latin.woff2',
  'css/fonts/nunito-cyr-ext.woff2', 'css/fonts/nunito-cyr.woff2',
  'css/fonts/nunito-viet.woff2', 'css/fonts/nunito-latin-ext.woff2',
  'css/fonts/nunito-latin.woff2',
  'js/app.js', 'js/config.example.js',
  'js/core/state.js', 'js/core/router.js',
  'js/data/index.js', 'js/data/store-common.js', 'js/data/store-local.js',
  'js/data/store-cloud.js', 'js/data/sync-queue.js', 'js/data/supabase.js',
  'js/lib/srs.js', 'js/lib/activity.js', 'js/lib/stats.js',
  'js/ui/ui.js', 'js/ui/shell.js', 'js/ui/helpers.js', 'js/ui/constants.js',
  'js/ui/rich-editor.js', 'js/ui/card-face.js', 'js/ui/activity-calendar.js', 'js/ui/raven-brand.js',
  'js/ui/swipe-grades.js',
  'js/screens/auth/index.js',
  'js/screens/home/index.js', 'js/screens/home/folder-dialog.js',
  'js/screens/folder/index.js',
  'js/screens/review/index.js', 'js/screens/review/flip-card.js',
  'js/screens/settings/index.js',
  'js/screens/card-editor/index.js',
  'icons/icon.svg', 'icons/logo.svg', 'icons/raven.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'icons/The%20crow%20with%20the%20tombstone.svg', 'icons/Scarecrow.svg', 'icons/feather.svg',
  'icons/cup.svg', 'icons/ghost.svg', 'icons/empty%20cage.svg', 'icons/Bird%20cage.svg',
  'icons/ghost.png', 'icons/feather.png', 'icons/raven.png',
  'icons/Scarecrow.png', 'icons/Bird%20cage.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isStorageImage = url.pathname.includes('/storage/v1/object/public/');
  const isSameOrigin = url.origin === location.origin;
  if (!isSameOrigin && !isStorageImage) return;

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: isSameOrigin }))
  );
});
