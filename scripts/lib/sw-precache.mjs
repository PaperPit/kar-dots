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

/** RU UI font subsets for install precache (unicode-range pulls the rest on demand). */
export const PRECACHE_FONTS = new Set([
  'css/fonts/baloo2-latin.woff2',
  'css/fonts/nunito-cyr.woff2',
  'css/fonts/nunito-latin.woff2',
  'css/fonts/nunito-cyr-ext.woff2',
  'css/fonts/nunito-latin-ext.woff2',
]);

/**
 * Bundled screen entry chunks + heavy optional — runtime cache, not install precache.
 * Matches esbuild `{name}-{8HASH}.js` output.
 */
export const BUNDLE_LAZY_JS_RE =
  /^js\/(home|folder|review|settings|stats|auth|box|card-editor|fsrs-engine|capacitor-speech-recognition|motion)-[A-Z0-9]+\.js$/;

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

export function isBundleLazyJs(relPath) {
  return BUNDLE_LAZY_JS_RE.test(relPath);
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
 * Prod / bundled: walk dist/ after esbuild.
 * Excludes screen-entry / optional chunks and non-whitelisted fonts.
 */
export function buildPrecacheFromDist(distRoot) {
  const all = walkFiles(distRoot).filter((f) => !f.startsWith('js/vendor/'));
  const jsChunks = all.filter(
    (f) => /^js\/.*\.js$/.test(f) && !isBundleLazyJs(f),
  );
  const configFiles = all.filter((f) => /^config(\.example)?\.js$/.test(f));
  const uiIcons = all.filter(
    (f) => /^icons\/.*\.(svg|png)$/.test(f) && !EXCLUDE_ICONS.has(f) && !f.startsWith('icons/folders/'),
  );
  const cssFiles = all.filter((f) => f.endsWith('.css'));
  const fontFiles = all.filter((f) => PRECACHE_FONTS.has(f));

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
    if (f.endsWith('.css')) files.add(`css/${f}`);
    else if (f.endsWith('.woff2') && PRECACHE_FONTS.has(`css/${f}`)) files.add(`css/${f}`);
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

/**
 * Fetch policy:
 * - hashed JS chunks → cache-first
 * - unhashed app shell (html/css/app.js) → stale-while-revalidate
 * - never force cache: 'no-cache' (that bypassed HTTP cache + ignored precache)
 */
const FETCH_HANDLER = `self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isStorageImage = url.pathname.includes('/storage/v1/object/public/');
  const isSameOrigin = url.origin === location.origin;
  if (!isSameOrigin && !isStorageImage) return;

  const path = url.pathname.replace(/^\\//, '');
  const lazy = isSameOrigin && isLazyPath(path);
  const hasRange = e.request.headers.has('range');
  const hashedChunk = isSameOrigin && /\\/[A-Za-z0-9_-]+-[A-Z0-9]{8}\\.js$/.test(url.pathname);
  const shellAsset = isSameOrigin && /\\.(js|css|html)$/.test(url.pathname) && !hashedChunk;

  function putInCache(req, resp) {
    if (resp.status === 200 && !hasRange) {
      const copy = resp.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
    }
  }

  if (hashedChunk) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          putInCache(e.request, resp);
          return resp;
        });
      }).catch(async () => {
        const cached = await caches.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        if (lazy) throw new Error('offline');
        throw new Error('offline');
      }),
    );
    return;
  }

  if (shellAsset) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        const network = fetch(e.request)
          .then(resp => {
            putInCache(e.request, resp);
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        putInCache(e.request, resp);
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

const BUNDLE_LAZY = [
  'audio/',
  'packs/en-',
  'icons/folders/',
  'js/home-',
  'js/folder-',
  'js/review-',
  'js/settings-',
  'js/stats-',
  'js/auth-',
  'js/box-',
  'js/card-editor-',
  'js/fsrs-engine-',
  'js/capacitor-speech-recognition-',
  'js/motion-',
];

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

/**
 * Pick modulepreload hrefs for dist/index.html from esbuild metafile.
 * @param {import('esbuild').Metafile} metafile
 * @param {string} distRoot
 * @returns {string[]} hrefs relative to dist/ (e.g. js/app.js)
 */
export function pickModulePreloads(metafile, distRoot) {
  const outputs = metafile?.outputs || {};
  const hrefs = [];
  const appKey = Object.keys(outputs).find((k) => k.endsWith('/js/app.js') || k.endsWith('\\js\\app.js'));
  if (appKey) hrefs.push('js/app.js');

  const chunks = Object.entries(outputs)
    .filter(([k, v]) => {
      const base = path.basename(k);
      return /^chunk-[A-Z0-9]+\.js$/.test(base) && v.bytes > 0;
    })
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 2)
    .map(([k]) => {
      const rel = path.relative(distRoot, path.resolve(k)).split(path.sep).join('/');
      return rel.startsWith('js/') ? rel : `js/${path.basename(k)}`;
    });

  for (const c of chunks) {
    if (!hrefs.includes(c)) hrefs.push(c);
  }
  return hrefs;
}

/** Inject <link rel="modulepreload"> into HTML string (after charset/viewport if possible). */
export function injectModulePreloads(html, hrefs) {
  if (!hrefs.length) return html;
  const tags = hrefs.map((h) => `  <link rel="modulepreload" href="${h}">`).join('\n');
  if (html.includes('rel="modulepreload"')) return html;
  if (html.includes('</head>')) return html.replace('</head>', `${tags}\n</head>`);
  return `${tags}\n${html}`;
}
