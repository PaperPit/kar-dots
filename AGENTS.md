# AGENTS.md — контракт агента (КАР-точки)

## Проект

PWA **КАР-точки** (`PaperPit/kar-dots`): карточки + SRS + заметки. Vanilla TypeScript → ES modules, **без bundler в dev**. Хостинг: Cloudflare Pages. Режим по умолчанию — **local-first** (IndexedDB); опциональный snapshot-синк через Cloudflare D1; Supabase cloud — **legacy**.

## Команды

- Установка / dev: `npm ci` → `npm run dev`
- Быстрая петля: `npm run check:quick` — typecheck + lint + unit-тесты
- Полная локальная верификация: `npm run check` — паритет с CI check (без e2e)
- E2E: `npm run test:e2e` (нужен Chromium: `npm run test:e2e:install`)
- Самотест обвязки: `npm run harness:test`
- Прод-сборка: `npm run build:bundle`

## Жёсткие ограничения (MUST)

- Слои: `js/data/` · `js/lib/` · `js/ui/` · `js/screens/` — см. `CLAUDE.md`. `lib/` не импортирует из `screens/`.
- Не коммитить и не пушить без явной просьбы пользователя.
- Не хардкодить секреты/API keys (UI настроек, `.env`, `config.js` — личное не в git).
- Дубли `js/` ↔ iOS `www/` — только через `npm run ios:prepare`, не двумя руками.
- Крупные фичи — **фазами**; одна активная фича в `feature_list.json` (WIP=1).
- Не ставить `state: "passing"` в `feature_list.json` вручную — только после зелёной команды из поля `verification`.
- После значимых JS-изменений: как минимум `npm run check:quick`. SW/precache → `sw:generate` / bundle. API sync → учитывать D1 + `SYNC_JWT_SECRET`.

## Definition of Done

Фича готова = команда из `verification` в `feature_list.json` зелёная + (для UI) e2e/ручной прогон по сценарию.  
«Код написан» — это **не** готово.

## Правила работы

- Одна фича за раз. Не начинать следующую, пока текущая не прошла верификацию (или не `blocked` с причиной).
- Никакого рефакторинга «заодно», пока основная фича не проверена.
- Перед завершением значимой сессии обновить `PROGRESS.md` (состояние, решения, следующие шаги).
- Отвечать по-русски, коротко по итогу.

## Куда смотреть подробности

- `CLAUDE.md` — слои, заметки, список npm-команд продукта
- `docs/AGENT.md` — роутер «куда идти по типу задачи» + диагностика harness
- `docs/ARCHITECTURE.md` — runtime, sync (local / CF / legacy Supabase)
- `docs/API.md` — Cloudflare Pages Functions `/api/*`
- `docs/DEPLOY.md` — деплой Pages
- `.cursor/rules/kar-agent-workflow.mdc` — shipping / UX loops Cursor
- `feature_list.json` — WIP и критерии приёмки
- `PROGRESS.md` — состояние между сессиями
- `ROADMAP.md` — продуктовый бэклог (не заменяет feature_list)
