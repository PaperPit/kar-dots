# Прогресс

## Состояние на сейчас

- Локально: `pages:dev` на http://localhost:8788 (`.dev.vars` + D1 + R2 + KV)
- Автотесты: `npm run check` + e2e Cloudflare + `harness:test` — OK
- API smoke на localhost:8788: register → `POST /api/files` → signed GET → push/pull (в т.ч. 2-й clientId) — OK
- Прод Cloudflare: **нужен `npx wrangler login`** (токен протух / нет `CLOUDFLARE_API_TOKEN`)
- Коммит/деплой: не делались (нужна явная команда + login)

## Сделано в этой сессии (verify/run)

- [x] Автопроверка
- [x] `.dev.vars`, `d1:migrate`, `pages:dev` (секция `[ai]` в wrangler.toml отключена для локального запуска без login)
- [x] Скрипт прод-инфры: `bash scripts/cf-infra-setup.sh`
- [x] Ручная приёмка API на локальном стеке

## Блокер прод

1. В своём терминале: `npx wrangler login`
2. `bash scripts/cf-infra-setup.sh`
3. Dashboard: R2 binding `CARD_IMAGES` + Secret `SYNC_JWT_SECRET`
4. Написать агенту: **закоммить и задеплой**

## Следующие шаги

1. Wrangler login + infra script + secret/binding.
2. Commit + `npm run pages:deploy`.
3. Ручной прогон на `*.pages.dev` (картинка → `r2:`).
