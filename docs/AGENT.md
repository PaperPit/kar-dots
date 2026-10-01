# Agent router — куда смотреть по типу задачи

Корневой контракт: [AGENTS.md](../AGENTS.md). Продуктовые слои: [CLAUDE.md](../CLAUDE.md). Состояние: [PROGRESS.md](../PROGRESS.md), WIP: [feature_list.json](../feature_list.json).

## Роутер

| Задача | Куда идти |
|--------|-----------|
| Store / IndexedDB / LocalStore | `js/data/store-local.ts`, `store-contract.ts`, тесты `tests/store-local.test.js` |
| SRS counts / review queue | `js/data/srs-query.ts`, `js/lib/srs.ts`, `js/data/srs-meta.ts` |
| IndexedDB / LocalStore | `js/data/store-local.ts`, `js/data/store-contract.ts` |
| Cloudflare sync / R2 files | `js/data/cf-auth.ts`, `js/data/cf-sync.ts`, `js/data/cf-files.ts`, `functions/api/sync/*`, `functions/api/files.js` |
| Sync queue helpers (IDB indexGetAll) | `js/data/sync-queue.ts` |
| Cloudflare sync (D1 snapshot) | `js/data/cf-auth.ts`, `js/data/cf-sync.ts`, `functions/api/auth/*`, `functions/api/sync/*`, `migrations/`, Settings `js/screens/settings/sections/cf-sync.ts` |
| `/api/*` (YT, TTS, translate, stock) | `functions/api/`, [API.md](./API.md), middleware rate-limit |
| UI-экран | `js/screens/<name>/`, CSS `css/screens/`, строки `js/lib/locales/{ru,en}.ts` |
| Заметки / wiki / граф | `js/screens/notes/`, `js/screens/note/`, `js/lib/markdown.ts`, `note-links.ts` |
| Service Worker / prod bundle | `npm run build:bundle`, `scripts/bundle.mjs`, `sw.js` / `sw:generate` |
| iOS / Capacitor | `npm run ios:prepare`, `docs/ios-app-setup.md` |
| Chrome extension | `extension/`, `docs/chrome-extension.md` |

## Диагностика harness (агент «сломался»)

1. Воспроизведите отказ дважды на минимальной задаче.
2. Слой: постановка → инструкции (`AGENTS.md`) → состояние (`PROGRESS.md`) → среда (`npm run check:quick`) → верификация (поле `verification` в feature_list).
3. Не апгрейдить модель, пока не закрыта дырка в репо (файл/команда/тест).

## Бюджет контекста

- `AGENTS.md` ≤ ~150 строк. Детали — сюда и в `docs/*`, не в корневой контракт.
- Не дублировать длинные гайды в cursor rules — ссылка на `AGENTS.md`.
