#!/usr/bin/env node
/**
 * CI / post-build: every path in dist/sw.js CORE_FILES must exist under dist/.
 * Fails hard — a missing file would make cache.addAll reject the whole install.
 *
 * Usage: node scripts/check-sw-precache.mjs
 * Expects: npm run build:bundle (or populated dist/ + dist/sw.js)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPrecacheInDist } from './lib/sw-precache.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SW = path.join(DIST, 'sw.js');

if (!fs.existsSync(SW)) {
  console.error('Missing dist/sw.js — run npm run build:bundle first');
  process.exit(1);
}

const source = fs.readFileSync(SW, 'utf8');
const result = assertPrecacheInDist(source, DIST);

if (!result.ok) {
  console.error(
    `SW precache check failed: ${result.missing.length} path(s) in dist/sw.js missing from dist/:\n` +
      result.missing.map((m) => `  - ${m}`).join('\n'),
  );
  process.exit(1);
}

console.log(`SW precache OK — ${result.files.length} paths exist under dist/`);
