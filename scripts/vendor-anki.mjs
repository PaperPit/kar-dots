#!/usr/bin/env node
/**
 * Vendor fflate + sql.js (asm, no WASM) for Anki .apkg import.
 * sql-asm is patched to force the browser path (no node:fs) so the same
 * file works in Vitest/Node and in the PWA.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'js', 'vendor');
fs.mkdirSync(VENDOR, { recursive: true });

await build({
  entryPoints: [path.join(ROOT, 'node_modules/fflate/esm/browser.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(VENDOR, 'fflate.mjs'),
  logLevel: 'info',
});

const src = fs.readFileSync(path.join(ROOT, 'node_modules/sql.js/dist/sql-asm.js'), 'utf8');
const patched = src
  .replace(
    /ca=globalThis\.process\?\.versions\?\.node&&"renderer"!=globalThis\.process\?\.type;/,
    'ca=false; /* kar: force browser path */',
  )
  // Dead Node branches still contain require("node:…"); strip for esbuild/browser.
  .replace(/require\("node:fs"\)/g, 'null')
  .replace(/require\("node:crypto"\)/g, 'null');
if (!patched.includes('ca=false; /* kar: force browser path */')) {
  throw new Error('vendor-anki: failed to patch sql-asm node detection');
}
const out = `/* auto-generated from sql.js/dist/sql-asm.js — do not edit; run npm run vendor:anki */
var module = { exports: {} };
var exports = module.exports;
${patched}
var __init = (module.exports && module.exports.default) ? module.exports.default : module.exports;
export default __init;
`;
fs.writeFileSync(path.join(VENDOR, 'sql-asm.mjs'), out);
console.log('[vendor:anki] wrote js/vendor/fflate.mjs + js/vendor/sql-asm.mjs');
