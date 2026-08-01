#!/usr/bin/env node
/**
 * Генерирует sw.js из собранных файлов проекта (js/, скомпилированный TS на месте).
 * Запуск: node scripts/generate-sw-files.js
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { EXCLUDE_ICONS, PRECACHE_FONTS } from './sw-precache-assets.mjs';
import { swFetchHandlerSource } from './sw-fetch-handler.mjs';

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

/** Не precache — кэшируются при первом fetch (runtime). Пути в js/ (скомпилированный TS на месте). */
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

const JS_FILES = (await walk(join(ROOT, 'js')))
  .filter(f => /\.(js|mjs)$/.test(f) && f !== 'js/config.js' && f !== 'js/config.example.js')
  .sort();
const ICON_SVG = (await walk(join(ROOT, 'icons')))
  .filter(f => /\.(svg|png)$/.test(f) && !EXCLUDE_ICONS.has(f))
  .sort();
const FOLDER_ICONS = ICON_SVG.filter(f => f.startsWith('icons/folders/'));
const UI_ICONS = ICON_SVG.filter(f => !f.startsWith('icons/folders/'));

const CORE_STATIC = [
  './', 'index.html', 'manifest.webmanifest', 'boot-theme.js',
  'css/style.css', 'css/components/modal.css',
  'css/screens/home.css', 'css/screens/folder.css',
  'css/screens/card-editor.css', 'css/screens/review.css', 'css/screens/settings.css',
  'css/screens/youtube-import.css', 'css/screens/stats.css',
  'css/fonts/fonts.css',
  ...PRECACHE_FONTS,
  'packs/manifest.json',
];

const PRECACHE_JS = JS_FILES.filter(f => !isRuntimeAsset(f));
const list = [...CORE_STATIC, ...PRECACHE_JS, ...UI_ICONS];
const unique = [...new Set(list)];

const versionSrc = await readFile(join(ROOT, 'js/core/version.js'), 'utf8').catch(async () =>
  readFile(join(ROOT, 'js/core/version.ts'), 'utf8'),
);
const versionMatch = versionSrc.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
const version = versionMatch ? versionMatch[1] : 'kar-v15.5';

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

${swFetchHandlerSource()}`;

const swPath = join(ROOT, 'sw.js');
await writeFile(swPath, next);
console.log(`Updated sw.js — ${unique.length} precache files, VERSION=${version} (${JS_FILES.length - PRECACHE_JS.length} runtime JS, ${FOLDER_ICONS.length} runtime folder icons)`);
