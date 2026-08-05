# Как участвовать в КАР-точках

КАР-точки — **open source для личного self-host**: форк, деплой для себя и друзей, доработки в upstream. Спасибо, что заглянули!

## С чего начать (≈ 15 минут)

1. Прочитайте [README.md](./README.md) и [docs/USER-GUIDE.md](./docs/USER-GUIDE.md)
2. Архитектура: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · API: [docs/API.md](./docs/API.md) · слои: [CLAUDE.md](./CLAUDE.md)
3. Установка:
   ```bash
   npm install
   npm run typecheck   # tsc --noEmit (+ extension)
   npm run dev         # http://localhost:8080 — tsc emit + static server
   ```
4. Тесты: `npm test` · покрытие gates: `npm run test:coverage` · e2e: `npm run test:e2e` (нужен Chromium: `npm run test:e2e:install`)
5. Прод-сборка: `npm run build:bundle` → `dist/`
6. Расширение: `npm run ext:build` → load unpacked из `extension/`

## Стек (важно)

- Исходники — **TypeScript** (`js/**/*.ts`), в dev компилируются `tsc` на место в `js/**/*.js` (gitignored)
- Dev — **без бандлера**: ESM из корня; prod — **esbuild** в `dist/`
- Бэкенд API — **Cloudflare Pages Functions** (`functions/api/`), не Netlify
- UI-строки — `t()` + `js/lib/locales/{ru,en}.ts` (см. `npm run i18n:check`)

## Что приветствуется

- Исправления багов с воспроизведением
- UX / a11y
- Документация и переводы
- Тесты на `js/lib/` и `js/data/`
- Небольшие фичи из [ROADMAP.md](./ROADMAP.md) с обсуждением в Issue **до** большого PR

## Что лучше сначала обсудить

- Смена формата данных / схемы Supabase
- Новые тяжёлые зависимости
- Крупные фичи (Anki media/scheduling, коллаборация) — сначала Issue + набросок API

## Стиль кода

- Новый экран: `js/screens/<name>/index.ts` + `css/screens/<name>.css`
- Навигация только через `js/ui/navigation.ts` (`nav`)
- SRS-предикаты — `js/data/srs-query.ts` + `js/lib/srs.ts`
- Минимальный diff: не рефакторить «заодно»
- После изменения списка precache: `npm run sw:generate` и bump `APP_VERSION` в `js/core/version.ts`
- `www/` — артефакт Capacitor; не правьте руками (`npm run ios:prepare`)

## Pull request

1. Форк → ветка `feature/…` или `fix/…` (cloud-агенты используют `cursor/…-8cec`)
2. Зелёные: `npm run typecheck`, `npm run lint`, `npm run i18n:check`, `npm test`
3. В описании: **зачем**, скрин/видео для UI, **Test plan**
4. Одна логическая тема на PR

## Релизы

Версии приложения: `APP_VERSION` в `js/core/version.ts`.  
GitHub Releases: тег `v*` (например `v0.2.0`) → workflow `.github/workflows/release.yml` берёт секцию из [CHANGELOG.md](./CHANGELOG.md).

```bash
# на main после merge:
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

## Issues

| Шаблон | Когда |
|--------|--------|
| [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml) | что-то сломалось |
| [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml) | идея или roadmap |
| [Question](.github/ISSUE_TEMPLATE/question.yml) | как настроить / как устроено |

## Коммуникация

- Язык: русский или английский
- Указывайте браузер, режим (local/cloud), шаги воспроизведения
- Мелкий fix — можно сразу PR

## Лицензия

Участвуя, вы соглашаетесь, что вклад распространяется под [MIT](./LICENSE).
