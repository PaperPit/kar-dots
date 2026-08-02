/**
 * Единый источник правды для «ручных» списков ассетов сервис-воркера.
 *
 * Импортируется обоими генераторами SW:
 *   - scripts/generate-sw-files.js — корневой sw.js (dev / unbundled)
 *   - scripts/bundle.mjs           — dist/sw.js (прод-бандл)
 *
 * Раньше списки жили в каждом скрипте отдельно и разъезжались: прод-бандл
 * прекешил ВСЕ .woff2 из css/fonts/, включая неиспользуемый deva (115 КБ).
 * Правьте только здесь. Зависимостей нет — чистый ESM.
 */

/** PNG-дубликаты SVG и неиспользуемые ассеты — не кэшировать (см. js/ui/icons.ts). */
export const EXCLUDE_ICONS = new Set([
  'icons/ghost.png',
  'icons/feather.png',
  'icons/raven.png',
  'icons/Scarecrow.png',
  'icons/Bird cage.png',
  'icons/star-empty.svg',
]);

/**
 * Шрифты для precache. Пара «МОДЕРНИЗМ-80»: Unbounded (дисплей) + Golos Text
 * (текст), десять @font-face по unicode-range. При первом старте нужны шесть.
 *
 * Латиница обязательна наравне с кириллицей: цифры (U+0030–0039) лежат
 * именно в латинском срезе, а числа в приложении на каждом экране — счётчики
 * колод, интервалы, календарь. Без неё первый кадр показывает цифры
 * системным шрифтом и потом перерисовывает.
 *
 * Unbounded 800 (герой) и Golos 500/600 latin браузер запросит сам, когда
 * встретит нужные символы, — они осядут в runtime-кэше. В атомарный
 * cache.addAll их тянуть незачем: он падает целиком от одного 404.
 *
 * Файлы кладёт scripts/fetch-fonts.sh. Пока его не выполнили, этот список
 * отфильтруется в пустой (оба генератора делают .filter по фактическому
 * наличию), и сборка не сломается — просто без прекеша шрифтов.
 */
export const PRECACHE_FONTS = [
  'css/fonts/unbounded-cyr.woff2',
  'css/fonts/unbounded-latin.woff2',
  'css/fonts/golos-cyr.woff2',
  'css/fonts/golos-latin.woff2',
  'css/fonts/golos-500-cyr.woff2',
  'css/fonts/golos-600-cyr.woff2',
];

/** Попадает ли путь (относительно корня сайта) в precache-набор шрифтов. */
export function isPrecachedFont(path) {
  return PRECACHE_FONTS.includes(path);
}
