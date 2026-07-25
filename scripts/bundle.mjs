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
import {
  assertPrecacheInDist,
  buildPrecacheFromDist,
  renderBundleSw,
} from './lib/sw-precache.mjs';

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

// --- Precache list from built dist/ only (never dirty js/*.js) ---
const unique = buildPrecacheFromDist(DIST);
const VERSION = 'kar-v15.4-bundle';
const swBody = renderBundleSw({ version: VERSION, coreFiles: unique });
const check = assertPrecacheInDist(swBody, DIST);
if (!check.ok) {
  console.error(
    'bundle: dist/sw.js would reference missing files:\n' +
      check.missing.map((m) => `  - ${m}`).join('\n'),
  );
  process.exit(1);
}
fs.writeFileSync(path.join(DIST, 'sw.js'), swBody);
const jsChunks = unique.filter((f) => /^js\/.*\.js$/.test(f));
console.log(`bundle: dist/ готов. Прекеш: ${unique.length} файлов, JS-чанков: ${jsChunks.length}`);
