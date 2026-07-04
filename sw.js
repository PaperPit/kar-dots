// КАР-точки — service worker
// Стратегия «сначала сеть, потом кэш»: свежие файлы при интернете,
// работа офлайн без него. Картинки карточек кэшируются отдельно.
const VERSION = 'kar-v1';
const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css',
  'js/config.js', 'js/ui.js', 'js/srs.js', 'js/supabase.js', 'js/store.js', 'js/app.js',
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
  // запросы к Supabase не кэшируем (кроме картинок из Storage)
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
