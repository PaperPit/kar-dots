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
 * Шрифты для precache. В css/fonts/fonts.css объявлено девять @font-face
 * (по unicode-range), но при первом старте нужны только эти пять: Baloo 2 latin
 * для заголовков и полный Nunito (кириллица + латиница) для текста.
 * Остальные срезы (baloo2-deva/ext/viet, nunito-viet) браузер запросит сам,
 * только если встретит соответствующие символы, — и они осядут в runtime-кэше.
 * Особенно важен deva: 115 КБ в атомарном cache.addAll ради текста,
 * которого в приложении нет.
 */
export const PRECACHE_FONTS = [
  'css/fonts/baloo2-latin.woff2',
  'css/fonts/nunito-cyr-ext.woff2',
  'css/fonts/nunito-cyr.woff2',
  'css/fonts/nunito-latin-ext.woff2',
  'css/fonts/nunito-latin.woff2',
];

/** Попадает ли путь (относительно корня сайта) в precache-набор шрифтов. */
export function isPrecachedFont(path) {
  return PRECACHE_FONTS.includes(path);
}
