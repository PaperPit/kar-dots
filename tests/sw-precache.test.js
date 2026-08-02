// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Стражник для AUTO-GENERATED списка CORE_FILES в sw.js.
 *
 * CORE_FILES собирается скриптом scripts/generate-sw-files.js обходом диска и
 * коммитится в sw.js. Список легко протухает: файл переименовали/удалили, а
 * `npm run sw:generate` не прогнали. Установка SW при этом падает ЦЕЛИКОМ —
 * cache.addAll атомарен: один 404 отменяет весь прекеш, и приложение остаётся
 * без офлайна. Пусть лучше упадёт CI, чем прод.
 */

const ROOT = process.cwd();
const SW = readFileSync(join(ROOT, 'sw.js'), 'utf8');

/** Вырезаем список между `const CORE_FILES` и `const LAZY_PREFIXES`. */
function readCoreFiles() {
  const start = SW.indexOf('const CORE_FILES');
  const end = SW.indexOf('const LAZY_PREFIXES');
  if (start < 0 || end <= start) {
    throw new Error('sw.js: не найден блок CORE_FILES — изменился формат генератора?');
  }
  return [...SW.slice(start, end).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/**
 * Путь валиден, если файл есть на диске ИЛИ это вывод tsc: sw.js прекешит
 * js/foo.js, а в git лежит js/foo.ts (TypeScript компилируется на место,
 * js/**\/*.js в .gitignore и в чистом клоне отсутствует).
 */
function resolvesOnDisk(rel) {
  if (rel === './') return existsSync(join(ROOT, 'index.html'));
  if (existsSync(join(ROOT, rel))) return true;
  if (rel.startsWith('js/') && rel.endsWith('.js')) {
    return existsSync(join(ROOT, `${rel.slice(0, -3)}.ts`));
  }
  return false;
}

describe('service worker: precache-список в sw.js', () => {
  const coreFiles = readCoreFiles();

  it('каждый путь из CORE_FILES существует (иначе cache.addAll уронит install)', () => {
    const missing = coreFiles.filter((f) => !resolvesOnDisk(f));
    expect(missing, `Протух список в sw.js — прогоните npm run sw:generate. Нет файлов: ${missing.join(', ')}`).toEqual([]);
  });

  it('список не выглядит обрезанным', () => {
    // Если запустить генератор до `tsc`, скомпилированных js/**/*.js на диске нет
    // и список схлопывается до ~36 записей вместо ~125 — это тоже поломка.
    expect(coreFiles.length).toBeGreaterThan(60);
    expect(coreFiles).toContain('./');
    expect(coreFiles).toContain('index.html');
    expect(coreFiles).toContain('js/app.js');
  });

  it('нет дублей — cache.addAll не любит лишнюю работу', () => {
    const seen = new Set();
    const dupes = coreFiles.filter((f) => (seen.has(f) ? true : (seen.add(f), false)));
    expect(dupes).toEqual([]);
  });

  it('токены стилей прекешатся — без них первый офлайн-кадр без единого цвета', () => {
    expect(coreFiles).toContain('css/tokens.css');
  });

  it('шрифты в прекеше — только из allowlist scripts/sw-precache-assets.mjs', async () => {
    const { PRECACHE_FONTS } = await import('../scripts/sw-precache-assets.mjs');
    const fonts = coreFiles.filter((f) => f.endsWith('.woff2'));

    // Ожидаем не весь allowlist, а его пересечение с диском. Генератор
    // выбрасывает отсутствующие файлы намеренно: cache.addAll атомарен, и
    // один 404 отменяет весь прекеш — лучше остаться без прекеша шрифтов,
    // чем без офлайна целиком. Из-за этого список в sw.js законно короче
    // allowlist'а в промежутке между сменой шрифтовой пары и вендорингом
    // .woff2 (scripts/fetch-fonts.sh).
    const onDisk = PRECACHE_FONTS.filter((f) => existsSync(join(ROOT, f)));
    expect(
      fonts.sort(),
      'Список шрифтов в sw.js разошёлся с allowlist — прогоните npm run sw:generate',
    ).toEqual([...onDisk].sort());

    // Исходный смысл стража: ничего сверх allowlist'а. Иначе в атомарный
    // addAll утекают лишние срезы (когда-то так уезжал deva на 115 КБ).
    const strays = fonts.filter((f) => !PRECACHE_FONTS.includes(f));
    expect(strays, `Шрифты вне allowlist: ${strays.join(', ')}`).toEqual([]);
  });
});
