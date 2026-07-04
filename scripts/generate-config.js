#!/usr/bin/env node
/**
 * Создаёт js/config.js при деплое (Netlify / CI).
 * Ключи Supabase — из переменных окружения SUPABASE_URL и SUPABASE_ANON_KEY.
 * Если не заданы — демо-режим (пустой конфиг).
 */
import { writeFileSync, copyFileSync, existsSync } from 'fs';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (url && key) {
  writeFileSync('js/config.js', `export default {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
};
`);
  console.log('config.js: Supabase keys from environment');
} else if (existsSync('js/config.js')) {
  console.log('config.js: using existing local file');
} else {
  copyFileSync('js/config.example.js', 'js/config.js');
  console.log('config.js: copied from config.example.js (demo mode)');
}
