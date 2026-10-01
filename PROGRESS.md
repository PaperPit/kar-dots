# Прогресс

## Состояние на сейчас

- Прод: задеплоено на https://kar-tochki.pages.dev (preview https://979efa41.kar-tochki.pages.dev)
- Secret `SYNC_JWT_SECRET` задан на Pages
- D1 `kar-sync`: таблицы `cf_users` / `cf_sync_snapshots` на remote
- R2: **не включён в аккаунте Cloudflare** (API 10042) — binding временно закомментирован в `wrangler.toml`
- Локально: `pages:dev` → http://localhost:8788 (smoke API OK)
- Коммиты: `b28b458` (CF-only v17.1), `7040ec8` (defer R2); branch ahead of origin, **не push**

## Сделано (verify/run)

- [x] `npm run check` + e2e Cloudflare + harness
- [x] `.dev.vars` + `d1:migrate` + `pages:dev`
- [x] Локальный API: register → files → signed GET → push/pull
- [x] `SYNC_JWT_SECRET` на Pages
- [x] `npm run pages:deploy`
- [x] Скрипт `scripts/cf-infra-setup.sh`

## Осталось вам (R2)

1. Dashboard → **R2 → Enable** (billing/onboarding).
2. `npx wrangler r2 bucket create kar-card-images`
3. Раскомментировать `[[r2_buckets]]` в `wrangler.toml`.
4. `npm run pages:deploy` ещё раз.
5. По желанию: `git push` (ветка ahead/behind — нужен merge/rebase).

## Следующие шаги

1. Включить R2 и вернуть binding.
2. Ручной прогон на проде с картинкой → `r2:`.
3. Push в origin по явной просьбе.
