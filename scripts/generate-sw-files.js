#!/usr/bin/env node
/**
 * Regenerate service worker CORE_FILES.
 *
 * - Root sw.js (unbundled / iOS): from TypeScript sources → .js paths.
 *   Never walks gitignored compiled .js (orphan modules must not enter precache).
 * - dist/sw.js (prod): from built dist/ only. Requires npm run build:bundle first
 *   (or a populated dist/). Skipped with a warning if dist/ is missing.
 *
 * Usage: node scripts/generate-sw-files.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertPrecacheInDist,
  buildPrecacheFromDist,
  buildPrecacheFromSources,
  readSwVersion,
  renderBundleSw,
  renderUnbundledSw,
} from './lib/sw-precache.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ROOT_SW = path.join(ROOT, 'sw.js');
const DIST_SW = path.join(DIST, 'sw.js');

// --- Root sw.js from TypeScript sources ---
const rootFiles = buildPrecacheFromSources(ROOT);
const rootVersion = readSwVersion(ROOT_SW, 'kar-v15.4');
const rootBody = renderUnbundledSw({ version: rootVersion, coreFiles: rootFiles });
fs.writeFileSync(ROOT_SW, rootBody);
console.log(`Updated sw.js — ${rootFiles.length} precache files (из .ts sources, VERSION=${rootVersion})`);

// --- dist/sw.js from build output ---
if (!fs.existsSync(path.join(DIST, 'index.html')) || !fs.existsSync(path.join(DIST, 'js'))) {
  console.warn('dist/ не готов — пропускаю dist/sw.js. Сначала: npm run build:bundle');
  process.exit(0);
}

const distFiles = buildPrecacheFromDist(DIST);
const distVersion = readSwVersion(DIST_SW, readSwVersion(ROOT_SW, 'kar-v15.4-bundle'));
// Prefer explicit bundle version suffix if regenerating after bundle
const version =
  distVersion.includes('bundle') ? distVersion : `${rootVersion.replace(/-bundle$/, '')}-bundle`;
const distBody = renderBundleSw({ version, coreFiles: distFiles });
fs.writeFileSync(DIST_SW, distBody);

const check = assertPrecacheInDist(distBody, DIST);
if (!check.ok) {
  console.error('dist/sw.js CORE_FILES missing in dist/:\n' + check.missing.map((m) => `  - ${m}`).join('\n'));
  process.exit(1);
}
console.log(`Updated dist/sw.js — ${distFiles.length} precache files (из dist/, VERSION=${version})`);
