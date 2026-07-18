/**
 * Копирует статические файлы приложения в www/ для Capacitor (iOS).
 * Приложение компилируется на место в js/ (TS -> js/*.js).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(ROOT, 'www');

const COPY_FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const COPY_DIRS = ['css', 'js', 'icons', 'audio', 'packs'];

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

rmrf(WWW);
fs.mkdirSync(WWW, { recursive: true });

for (const name of COPY_FILES) {
  const src = path.join(ROOT, name);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(WWW, name));
}

for (const name of COPY_DIRS) {
  const src = path.join(ROOT, name);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(WWW, name), { recursive: true });
  }
}

// Конфиг лежит в js/config.js (сгенерирован generate-config.js перед копированием).
const configSrc = path.join(ROOT, 'js', 'config.js');
const configExample = path.join(ROOT, 'js', 'config.example.js');
const configDst = path.join(WWW, 'js', 'config.js');
if (fs.existsSync(configSrc)) {
  fs.copyFileSync(configSrc, configDst);
} else if (fs.existsSync(configExample)) {
  fs.copyFileSync(configExample, configDst);
  console.warn('prepare-ios-www: js/config.js не найден — скопирован config.example.js');
} else {
  console.warn('prepare-ios-www: ни js/config.js, ни js/config.example.js не найдены');
}

console.log('www/ готов для Capacitor');
