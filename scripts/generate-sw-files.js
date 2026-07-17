#!/usr/bin/env node
/**
 * Генерирует фрагмент CORE_FILES для sw.js из файлов проекта.
 * Запуск: node scripts/generate-sw-files.js
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..');

async function walk(dir, acc = []) {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.name === 'node_modules' || name.name === '.git' || name.name === 'graphify-out') continue;
    if (name.isDirectory()) await walk(full, acc);
    else acc.push(relative(ROOT, full).split('\\').join('/'));
  }
  return acc;
}

/** PNG-дубликаты SVG и неиспользуемые ассеты — не кэшировать (см. js/ui/icons.js). */
const EXCLUDE_ICONS = new Set([
  'icons/ghost.png',
  'icons/feather.png',
  'icons/raven.png',
  'icons/Scarecrow.png',
  'icons/Bird cage.png',
  'icons/star-empty.svg',
]);

/** Не precache — кэшируются при первом fetch (runtime). */
const RUNTIME_PREFIXES = [
  'js/screens/',
  'js/vendor/capacitor-speech-recognition.mjs',
  'js/vendor/ts-fsrs.mjs',
  'js/lib/fsrs-engine.js',
  'js/lib/speech-input.js',
  'js/lib/stock-media.js',
  'js/lib/cloze.js',
  'icons/folders/',
];

function isRuntimeAsset(path) {
  return RUNTIME_PREFIXES.some(p => path.startsWith(p) || path === p);
}

const JS_FILES = (await walk(join(ROOT, 'js'))).filter(f => /\.(js|mjs)$/.test(f) && f !== 'js/config.js').sort();
const ICON_SVG = (await walk(join(ROOT, 'icons')))
  .filter(f => /\.(svg|png)$/.test(f) && !EXCLUDE_ICONS.has(f))
  .sort();
const FOLDER_ICONS = ICON_SVG.filter(f => f.startsWith('icons/folders/'));
const UI_ICONS = ICON_SVG.filter(f => !f.startsWith('icons/folders/'));

const CORE_STATIC = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/components/modal.css',
  'css/screens/home.css', 'css/screens/folder.css',
  'css/screens/card-editor.css', 'css/screens/review.css', 'css/screens/settings.css',
  'css/screens/youtube-import.css',
  'css/fonts/fonts.css',
  'css/fonts/baloo2-latin.woff2',
  'css/fonts/nunito-cyr-ext.woff2', 'css/fonts/nunito-cyr.woff2',
  'css/fonts/nunito-latin-ext.woff2', 'css/fonts/nunito-latin.woff2',
  'packs/manifest.json',
];

const PRECACHE_JS = JS_FILES.filter(f => !isRuntimeAsset(f));
const list = [...CORE_STATIC, ...PRECACHE_JS, ...UI_ICONS];
const unique = [...new Set(list)];

const swPath = join(ROOT, 'sw.js');
const sw = await readFile(swPath, 'utf8');
const versionMatch = sw.match(/const VERSION = '([^']+)'/);
const version = versionMatch ? versionMatch[1] : 'kar-v14.0';

const body = unique.map(f => `  '${f}',`).join('\n');
const next = `const VERSION = '${version}';

/** AUTO-GENERATED CORE_FILES — node scripts/generate-sw-files.js */
const CORE_FILES = [
${body}
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

  const path = url.pathname.replace(/^\\//, '');
  const isAppJs = isSameOrigin && /\\.(js|css|html)$/.test(url.pathname);
  const lazy = isSameOrigin && isLazyPath(path);
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
        const cached = await caches.match(e.request, { ignoreSearch: isSameOrigin });
        if (cached) return cached;
        if (lazy) throw new Error('offline');
        return caches.match(e.request, { ignoreSearch: isSameOrigin });
      }),
  );
});
`;

await writeFile(swPath, next);
console.log(`Updated sw.js — ${unique.length} precache files (${JS_FILES.length - PRECACHE_JS.length} runtime JS, ${FOLDER_ICONS.length} runtime folder icons)`);
