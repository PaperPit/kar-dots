/**
 * Shared SW precache helpers.
 * Precache lists must come from build output (dist/) or TypeScript sources —
 * never from walking gitignored compiled js (orphan .js → cache.addAll 404).
 */
import fs from 'node:fs';
import path from 'node:path';

/** PNG duplicates / unused — see js/ui/icons.js */
export const EXCLUDE_ICONS = new Set([
  'icons/ghost.png',
  'icons/feather.png',
  'icons/raven.png',
  'icons/Scarecrow.png',
  'icons/Bird cage.png',
  'icons/star-empty.svg',
]);

/** Unbundled root sw.js — runtime cache, not install precache. */
export const UNBUNDLED_RUNTIME_PREFIXES = [
  'js/screens/',
  'js/vendor/capacitor-speech-recognition.mjs',
  'js/vendor/ts-fsrs.mjs',
  'js/lib/fsrs-engine.js',
  'js/lib/speech-input.js',
  'js/lib/stock-media.js',
  'js/lib/cloze.js',
  'icons/folders/',
];

export function walkFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function isRuntimeAsset(relPath, prefixes = UNBUNDLED_RUNTIME_PREFIXES) {
  return prefixes.some((p) => relPath.startsWith(p) || relPath === p);
}

export function parseCoreFiles(swSource) {
  const m = swSource.match(/const CORE_FILES = \[([\s\S]*?)\];/);
  if (!m) throw new Error('CORE_FILES array not found in service worker source');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/**
 * Assert every CORE_FILES path exists under distRoot (CI / post-build).
 * @returns {{ ok: true, files: string[] } | { ok: false, missing: string[], files: string[] }}
 */
export function assertPrecacheInDist(swSource, distRoot) {
  const files = parseCoreFiles(swSource);
  const missing = files.filter((f) => {
    const rel = f === './' ? 'index.html' : f.replace(/^\.\//, '');
    return !fs.existsSync(path.join(distRoot, rel));
  });
  return missing.length ? { ok: false, missing, files } : { ok: true, files };
}

/**
 * Prod / bundled: walk dist/ after esbuild (same rules as historical bundle.mjs).
 */
export function buildPrecacheFromDist(distRoot) {
  const all = walkFiles(distRoot).filter((f) => !f.startsWith('js/vendor/'));
  const jsChunks = all.filter((f) => /^js\/.*\.js$/.test(f));
  const configFiles = all.filter((f) => /^config(\.example)?\.js$/.test(f));
  const uiIcons = all.filter(
    (f) => /^icons\/.*\.(svg|png)$/.test(f) && !EXCLUDE_ICONS.has(f),
  );
  const cssFiles = all.filter((f) => f.endsWith('.css'));
  const fontFiles = all.filter((f) => f.endsWith('.woff2'));

  const list = [
    'index.html',
    'manifest.webmanifest',
    'packs/manifest.json',
    ...cssFiles,
    ...fontFiles,
    ...jsChunks,
    ...configFiles,
    ...uiIcons,
  ].filter((f) => f !== './' && fs.existsSync(path.join(distRoot, f)));

  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

/**
 * Unbundled (root sw.js / iOS www): map tracked TypeScript → .js paths.
 * Never walk gitignored compiled .js (orphan trap).
 */
export function buildPrecacheFromSources(repoRoot) {
  const files = new Set([
    './',
    'index.html',
    'manifest.webmanifest',
    'packs/manifest.json',
  ]);

  for (const f of walkFiles(path.join(repoRoot, 'css'), path.join(repoRoot, 'css'))) {
    if (f.endsWith('.css') || f.endsWith('.woff2')) files.add(`css/${f}`);
  }

  const jsRoot = path.join(repoRoot, 'js');
  for (const f of walkFiles(jsRoot, jsRoot)) {
    if (f.endsWith('.d.ts') || f.includes('.test.')) continue;
    if (f === 'config.ts' || f === 'config.example.ts') continue;

    let rel;
    if (f.endsWith('.ts')) rel = `js/${f.replace(/\.ts$/, '.js')}`;
    else if (f.endsWith('.mjs')) rel = `js/${f}`;
    else continue;

    if (rel === 'js/config.js' || rel === 'js/config.example.js') continue;
    if (isRuntimeAsset(rel)) continue;
    files.add(rel);
  }

  for (const f of walkFiles(path.join(repoRoot, 'icons'), path.join(repoRoot, 'icons'))) {
    const rel = `icons/${f}`;
    if (!/\.(svg|png)$/.test(rel)) continue;
    if (EXCLUDE_ICONS.has(rel)) continue;
    if (isRuntimeAsset(rel)) continue;
    files.add(rel);
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

const FETCH_HANDLER = `self.addEventListener('fetch', e => {
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

function renderSwShell(version, coreFiles, lazyPrefixes, generatedBy) {
  const list = coreFiles.map((f) => `  '${f}',`).join('\n');
  const lazy = lazyPrefixes.map((f) => `  '${f}',`).join('\n');
  return `const VERSION = '${version}';

/** AUTO-GENERATED CORE_FILES — ${generatedBy} */
const CORE_FILES = [
${list}
];

/** Кэшируются при первом обращении (офлайн после первого использования). */
const LAZY_PREFIXES = [
${lazy}
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

${FETCH_HANDLER}`;
}

const BUNDLE_LAZY = ['audio/', 'packs/en-', 'icons/folders/'];

const UNBUNDLED_LAZY = [
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

/** @param {{ version: string, coreFiles: string[] }} opts */
export function renderBundleSw({ version, coreFiles }) {
  return renderSwShell(version, coreFiles, BUNDLE_LAZY, 'node scripts/bundle.mjs');
}

/** @param {{ version: string, coreFiles: string[] }} opts */
export function renderUnbundledSw({ version, coreFiles }) {
  return renderSwShell(
    version,
    coreFiles,
    UNBUNDLED_LAZY,
    'node scripts/generate-sw-files.js',
  );
}

export function readSwVersion(swPath, fallback) {
  if (!fs.existsSync(swPath)) return fallback;
  const m = fs.readFileSync(swPath, 'utf8').match(/const VERSION = '([^']+)'/);
  return m ? m[1] : fallback;
}
