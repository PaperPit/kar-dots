#!/usr/bin/env node
/**
 * Создаёт js/config.js при деплое (Netlify / CI) или локально.
 * Ключи Supabase — из переменных окружения SUPABASE_URL и SUPABASE_ANON_KEY.
 * Если не заданы — оставляет существующий js/config.js (локальные ключи)
 * либо копирует config.example.js (демо-режим).
 *
 * Приложение компилируется на место в js/ (TS -> js/*.js), поэтому конфиг
 * генерируется туда же, откуда его читает initConfig (js/core/state.ts).
 */
import { writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const JS = join(ROOT, 'js');
const CONFIG = join(JS, 'config.js');
mkdirSync(JS, { recursive: true });

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (url && key) {
  writeFileSync(CONFIG, `export default {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
};
`);
  console.log('config.js: Supabase keys from environment');
} else if (existsSync(CONFIG)) {
  console.log('config.js: using existing js/config.js');
} else {
  copyFileSync(join(JS, 'config.example.js'), CONFIG);
  console.log('config.js: copied from config.example.js (demo mode)');
}
