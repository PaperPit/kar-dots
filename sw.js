const VERSION = 'kar-v3.4';
const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/config.example.js',
  'js/core/state.js', 'js/core/router.js',
  'js/data/index.js', 'js/data/store-common.js', 'js/data/store-local.js',
  'js/data/store-cloud.js', 'js/data/sync-queue.js', 'js/data/supabase.js',
  'js/lib/srs.js',
  'js/ui/ui.js', 'js/ui/shell.js', 'js/ui/helpers.js', 'js/ui/constants.js',
  'js/ui/rich-editor.js', 'js/ui/card-face.js',
  'js/screens/auth/index.js',
  'js/screens/home/index.js', 'js/screens/home/folder-dialog.js',
  'js/screens/folder/index.js',
  'js/screens/review/index.js', 'js/screens/review/flip-card.js',
  'js/screens/settings/index.js',
  'js/screens/card-editor/index.js',
  'icons/icon.svg', 'icons/logo.svg', 'icons/icon-192.png', 'icons/icon-512.png',
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
