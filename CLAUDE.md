# КАР-точки

Vanilla JS PWA (ES modules, **без bundler в dev**). Исходники — TypeScript (`js/**/*.ts`), компилируются `tsc` на место в `js/**/*.js` (gitignored).

- **Dev**: `npm run dev` отдаёт несобранные `js/*.js` из корня (`index.html` → `js/app.js` → `js/core/router.js`). Экраны ленивые через `await import()`.
- **Prod**: `npm run build:bundle` собирает esbuild-бандл в `dist/` (entry `js/app.js` + code-splitting чанки для lazy-экранов, минификация). Деплой публикует `dist/` (Cloudflare Pages, `wrangler.toml`), `dist/sw.js` генерируется скриптом. Точка входа прод-сборки: `dist/index.html` → `dist/js/app.js`.

## Слои

- `js/data/` — хранилища (`LocalStore`, `CloudStore`), контракт, SRS-запросы, sync-queue
- `js/lib/` — чистые утилиты (srs, shuffle, activity); **не** импортировать из `screens/`
- `js/ui/` — shell, helpers, ui-компоненты; навигация только через `js/ui/navigation.js` (`nav`), не из `shell.js`
- `js/screens/` — экраны; импортируют `ui/` и `data/`, не наоборот

## Команды

- `npm test` — Vitest (happy-dom)
- `npm run test:coverage` — unit + coverage thresholds (js emit, functions, extension)
- `npm run test:e2e` — Playwright smoke (`e2e/`)
- `npm run functions:check` — синтаксис/экспорты Cloudflare Pages Functions
- `npm run build:bundle` — прод-сборка: `tsc` + esbuild-бандл в `dist/` + генерация `dist/sw.js` (прекеш бандла + чанков + ассетов)
- `npm run ext:build` / `npm run ext:check` — сборка Chrome-расширения в `extension/dist/` (gitignored; load unpacked из `extension/` после `ext:build`)
- `npm run sw:generate` — корневой `sw.js` из `.ts`-источников (не из грязного `js/*.js`); при наличии `dist/` — ещё и `dist/sw.js`
- `npm run sw:check` — после `build:bundle`: каждый путь в `dist/sw.js` существует в `dist/` (CI)

## Конвенции

- Новые экраны: тонкий `index.js` + `sections/` или части по образцу `settings/`, CSS в `css/screens/`
- SRS-предикаты — только `js/data/srs-query.js` + `js/lib/srs.js`
- Slim SRS meta — `js/data/srs-meta.js`; in-memory cache — `js/data/store-cache.js`
- Cloud offline: mirror IDB + `SyncQueue`; не ломать `_srsMeta` / `_patchSrsMeta`
- **Не коммитить** без явной просьбы пользователя
