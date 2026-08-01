/**
 * Общий fetch-handler для sw.js (dev) и dist/sw.js (prod).
 * Не кэшируем /api/* и /storage/v1/* — иначе poll yt-job и signed URLs
 * могут отдать устаревший ответ из Cache API.
 */
export function swFetchHandlerSource() {
  return `self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isSameOrigin = url.origin === location.origin;
  if (!isSameOrigin) return;

  const path = url.pathname.replace(/^\\//, '');
  // API и storage — только сеть, без Cache API.
  if (path.startsWith('api/') || path.includes('storage/v1/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  const isAppJs = /\\.(js|css|html)$/.test(url.pathname);
  const lazy = isLazyPath(path);
  const hasRange = e.request.headers.has('range');

  e.respondWith(
    fetch(isAppJs ? new Request(e.request, { cache: 'no-cache' }) : e.request)
      .then(resp => {
        if (resp.status === 200 && !hasRange) {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(async () => {
        const cached = await caches.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        if (lazy) throw new Error('offline');
        return caches.match(e.request, { ignoreSearch: true });
      }),
  );
});
`;
}
