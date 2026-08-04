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
import { EXCLUDE_ICONS, PRECACHE_FONTS } from './sw-precache-assets.mjs';
import { swFetchHandlerSource } from './sw-fetch-handler.mjs';

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

const buildResult = await build({
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

 // --- Bundle size budgets ---
 const MAX_CHUNK_KB = 150
 const MAX_TOTAL_JS_KB = 800
 const metafile = buildResult.metafile
 if (metafile) {
   let totalJs = 0
   for (const [fileName, info] of Object.entries(metafile.outputs)) {
     if (!fileName.endsWith('.js')) continue
     const sizeKb = (info.bytes || 0) / 1024
     totalJs += sizeKb
     if (sizeKb > MAX_CHUNK_KB) {
       console.warn(`[bundle] WARNING: ${fileName} is ${sizeKb.toFixed(1)}KB (limit: ${MAX_CHUNK_KB}KB)`)
     }
   }
   if (totalJs > MAX_TOTAL_JS_KB) {
     console.warn(`[bundle] WARNING: Total JS is ${(totalJs / 1024).toFixed(1)}MB (limit: ${MAX_TOTAL_JS_KB / 1024}MB)`)
   } else {
     console.log(`[bundle] Total JS: ${(totalJs / 1024).toFixed(1)}KB (limit: ${MAX_TOTAL_JS_KB / 1024}MB)`)
   }
 }

// --- Копируем статики (vendor .mjs бандлятся внутрь чанков, копировать не нужно) ---
cpDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
cpDir(path.join(ROOT, 'icons'), path.join(DIST, 'icons'));
cpDir(path.join(ROOT, 'packs'), path.join(DIST, 'packs'));
// Звуки (клики UI, верно/неверно, кубок) грузятся рантаймом с /audio/... —
// без копирования в dist/ на Cloudflare Pages все MP3 дают 404 и play() молчит.
cpDir(path.join(ROOT, 'audio'), path.join(DIST, 'audio'));
for (const f of ['manifest.webmanifest', 'index.html', 'boot-theme.js']) {
  if (fs.existsSync(path.join(ROOT, f))) cpFile(path.join(ROOT, f), path.join(DIST, f));
}
// Cloudflare Pages headers (CSP и пр.)
if (fs.existsSync(path.join(ROOT, 'public', '_headers')))
  cpFile(path.join(ROOT, 'public', '_headers'), path.join(DIST, '_headers'));
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

const all = walk(DIST).filter((f) => !f.startsWith('js/vendor/'));
const jsChunks = all.filter((f) => /^js\/.*\.js$/.test(f));
const configFiles = all.filter((f) => /^config(\.example)?\.js$/.test(f));
const uiIcons = all.filter((f) => /^icons\/.*\.(svg|png)$/.test(f) && !EXCLUDE_ICONS.has(f));
const cssFiles = all.filter((f) => f.endsWith('.css'));
// Шрифты — по общему allowlist (scripts/sw-precache-assets.mjs), а не «все .woff2
// из dist/»: остальные срезы копируются в dist/, но кэшируются рантаймом.
// cache.addAll атомарен, лишние 115 КБ deva тут никому не нужны.
const fontFiles = PRECACHE_FONTS.filter((f) => all.includes(f));

const CORE_FILES = ['./', 'index.html', 'manifest.webmanifest', 'packs/manifest.json', ...cssFiles, ...fontFiles, ...jsChunks, ...configFiles, ...uiIcons];
// убираем дубликаты и './'
const unique = [...new Set(CORE_FILES.filter((f) => f !== './'))].sort();

const swPath = path.join(DIST, 'sw.js');
// Синхронизируем VERSION с APP_VERSION из js/core/version.js (после tsc).
const versionSrc = fs.readFileSync(path.join(JS, 'core/version.js'), 'utf8');
const versionMatch = versionSrc.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
const VERSION = `${versionMatch?.[1] || 'kar-v15.5'}-bundle`;
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

${swFetchHandlerSource()}`;

fs.writeFileSync(swPath, swBody);
console.log(`bundle: dist/ готов. Прекеш: ${unique.length} файлов, JS-чанков: ${jsChunks.length}, SW ${VERSION}`);
