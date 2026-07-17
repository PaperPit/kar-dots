# Как участвовать в КАР-точках

КАР-точки — **open source для личного self-host**: форк, деплой для себя и друзей, доработки в upstream. Спасибо, что заглянули!

## С чего начать

1. Прочитайте [README.md](./README.md) и [docs/USER-GUIDE.md](./docs/USER-GUIDE.md) (деплой для пользователей)
2. Для разработки: `npm install` → `npm run dev` → http://localhost:8080
3. Тесты: `npm test`
4. Архитектура для агентов/людей: [CLAUDE.md](./CLAUDE.md)

## Что приветствуется

- Исправления багов с воспроизведением
- Улучшения UX и доступности (a11y)
- Документация и переводы
- Тесты на `js/lib/` и `js/data/`
- Небольшие фичи из roadmap с обсуждением в Issue **до** большого PR

## Что лучше сначала обсудить

- Смена формата данных / схемы Supabase
- Новые тяжёлые зависимости или bundler «для всего проекта»
- Крупные фичи (Anki import, multiplayer) — сначала Issue + набросок API

## Стиль кода

- **Vanilla JS**, ES modules, без сборки для runtime
- Новый экран: `js/screens/<name>/index.js` + `css/screens/<name>.css`
- Навигация только через `js/ui/navigation.js`
- SRS-предикаты — `js/data/srs-query.js` + `js/lib/srs.js`
- Минимальный diff: не рефакторить «заодно»
- После изменения списка precache: `npm run sw:generate` и bump `VERSION` в `sw.js`
- `www/` — генерируемый артефакт Capacitor. Не правьте его руками: пересоздайте через `npm run ios:prepare` перед `npm run ios:sync`.

## Pull request

1. Форк → ветка `feature/кратко` или `fix/кратко`
2. `npm test` зелёный
3. В описании PR: **зачем**, скрин/видео для UI, **Test plan** (чеклист)
4. Одна логическая тема на PR — проще ревью

## Issues

| Шаблон | Когда |
|--------|--------|
| [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml) | что-то сломалось |
| [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml) | идея или roadmap |
| [Question](.github/ISSUE_TEMPLATE/question.yml) | как настроить / как устроено |

## Коммуникация

- Язык: русский или английский — как удобнее
- Будьте конкретны: браузер, режим (local/cloud), шаги воспроизведения
- Не нужно спрашивать разрешение на мелкий fix — просто PR

## Лицензия

Участвуя, вы соглашаетесь, что вклад распространяется под [MIT](./LICENSE).
