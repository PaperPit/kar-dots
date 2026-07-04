// ============================================================
// КАР-точки — точка входа: запускается последним, когда все
// экраны (js/screens/*.js) уже подключены и заполнили Screens.
// ============================================================
(function () {
  'use strict';

  App.boot();

  // PWA: service worker (работает только по https или на localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
