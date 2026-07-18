#!/usr/bin/env node
/**
 * Прод-сборка: бандлит приложение через esbuild в dist/ (один entry + чанки для
 * динамических import), копирует статики и генерирует dist/sw.js с прекешем
 * только бандла + чанков + ассетов. dev-режим (npm run dev) этим не трогается —
 * он по-прежнему отдаёт несобранные js/*.js из корня.
 *
 * Запуск: node scripts/bundle.mjs
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const JS = path.join(ROOT, 'js');

const rmSync = (p) => fs.rmSync(p, { recursive: true, force: true });
const cpFile = (src, dst) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
};
const cpDir = (src, dst, filter = () => true) => {
  if (!fs.existsSync(src)) return;
  for (const name of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, name.name);
    const d = path.join(dst, name.name);
    if (name.isDirectory()) cpDir(s, d, filter);
    else if (filter(s)) cpFile(s, d);
  }
};

rmSync(DIST);

// config.js / config.example.js загружаются рантайм-import'ом в state.ts
// (../config.js). В бандле это резолвится относительно dist/js/app.js, поэтому
// оставляем их внешними и кладём рядом с бандлом (dist/js/config*.js).
const configExternal = {
  name: 'config-external',
  setup(b) {
    b.onResolve({ filter: /\.\.\/config(\.example)?\.js$/ }, (args) => ({
      path: './config' + (args.path.endsWith('.example.js') ? '.example.js' : '.js'),
      external: true,
    }));
  },
};

await build({
  entryPoints: [path.join(JS, 'app.js')],
  bundle: true,
  format: 'esm',
  splitting: true,
  outbase: 'js',
  outdir: path.join(DIST, 'js'),
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  metafile: true,
  conditions: ['browser'],
  plugins: [configExternal],
  logLevel: 'info',
});

// --- Копируем статики (vendor .mjs бандлятся внутрь чанков, копировать не нужно) ---
cpDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
cpDir(path.join(ROOT, 'icons'), path.join(DIST, 'icons'));
cpDir(path.join(ROOT, 'packs'), path.join(DIST, 'packs'));
for (const f of ['manifest.webmanifest', 'index.html']) {
  if (fs.existsSync(path.join(ROOT, f))) cpFile(path.join(ROOT, f), path.join(DIST, f));
}
// config грузится рантайм-import'ом через переменную (state.ts initConfig:
// '../config.js'), поэтому esbuild не может сделать его external и оставляет
// относительный резолв. В бандле чанки лежат в dist/js/, значит '../config.js'
// резолвится как dist/config.js — кладём конфиг в корень dist/.
if (fs.existsSync(path.join(JS, 'config.example.js')))
  cpFile(path.join(JS, 'config.example.js'), path.join(DIST, 'config.example.js'));
if (fs.existsSync(path.join(JS, 'config.js')))
  cpFile(path.join(JS, 'config.js'), path.join(DIST, 'config.js'));

// --- Собираем список прекеша для SW из собранного dist/ ---
const walk = (dir, acc = []) => {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, n.name);
    if (n.isDirectory()) walk(full, acc);
    else acc.push(path.relative(DIST, full).split('\\').join('/'));
  }
  return acc;
};

const EXCLUDE_ICONS = new Set([
  'icons/ghost.png', 'icons/feather.png', 'icons/raven.png',
  'icons/Scarecrow.png', 'icons/Bird cage.png', 'icons/star-empty.svg',
]);

const all = walk(DIST).filter((f) => !f.startsWith('js/vendor/'));
const jsChunks = all.filter((f) => /^js\/.*\.js$/.test(f));
const configFiles = all.filter((f) => /^config(\.example)?\.js$/.test(f));
const uiIcons = all.filter((f) => /^icons\/.*\.(svg|png)$/.test(f) && !EXCLUDE_ICONS.has(f));
const cssFiles = all.filter((f) => f.endsWith('.css'));
const fontFiles = all.filter((f) => f.endsWith('.woff2'));

const CORE_FILES = ['./', 'index.html', 'manifest.webmanifest', 'packs/manifest.json', ...cssFiles, ...fontFiles, ...jsChunks, ...configFiles, ...uiIcons];
// убираем дубликаты и './'
const unique = [...new Set(CORE_FILES.filter((f) => f !== './'))].sort();

const swPath = path.join(DIST, 'sw.js');
const VERSION = 'kar-v15.3-bundle';
const list = unique.map((f) => `  '${f}',`).join('\n');
const swBody = `const VERSION = '${VERSION}';

/** AUTO-GENERATED CORE_FILES — node scripts/bundle.mjs */
const CORE_FILES = [
${list}
];

/** Кэшируются при первом обращении (офлайн после первого использования). */
const LAZY_PREFIXES = [
  'audio/',
  'packs/en-',
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

fs.writeFileSync(swPath, swBody);
console.log(`bundle: dist/ готов. Прекеш: ${unique.length} файлов, JS-чанков: ${jsChunks.length}`);
