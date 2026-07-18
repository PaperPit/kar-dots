#!/usr/bin/env node
/**
 * Копирует не-TS ассеты из js/ после компиляции tsc (TS -> js/*.js на месте):
 *  - js/vendor/*.mjs  (предсобранные ESM, не компилируются tsc)
 *  - js/config.example.js (фолбэк конфига для demo-режима)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(ROOT, 'js');

function cp(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// vendor mjs
const vendor = path.join(JS, 'vendor');
if (fs.existsSync(vendor)) {
  for (const name of fs.readdirSync(vendor)) {
    if (name.endsWith('.mjs')) cp(path.join(vendor, name), path.join(JS, 'vendor', name));
  }
}

// config example fallback
const ex = path.join(JS, 'config.example.js');
if (fs.existsSync(ex)) cp(ex, path.join(JS, 'config.example.js'));

console.log('copy-assets: vendor + config.example.js -> js/');
