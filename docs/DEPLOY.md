# Деплой КАР-точек

> **Для пользователей:** пошаговая инструкция — [USER-GUIDE.md](./USER-GUIDE.md)

Этот файл — технические детали для админов инстанса (Functions, D1, R2, troubleshooting).

## Сценарии

| Кому | Деплой | Облачный синк |
|------|--------|----------------|
| Только вы, один браузер | `npm run dev` локально | нет |
| Вы, PWA на телефоне | **Cloudflare Pages** | опционально CF sync (D1 + R2) |
| Вы + несколько устройств | **Cloudflare Pages** | **CF sync** (JWT + D1 snapshot + R2 images) |

**Прод upstream:** [https://kar-tochki.pages.dev](https://kar-tochki.pages.dev)

Legacy Supabase больше не нужен. Архив схемы: [legacy/README.md](./legacy/README.md).

---

## Cloudflare Pages + Functions

Статика из `dist/` + API в `functions/api/*`.

Пошагово: **[cloudflare-pages-setup.md](./cloudflare-pages-setup.md)**. Кратко:

1. `npx wrangler login`
2. KV: `npx wrangler kv namespace create YT_JOBS` → `id` в [`wrangler.toml`](../wrangler.toml)
3. D1: `npx wrangler d1 create kar-sync` → `database_id` в wrangler; `npm run d1:migrate:remote`
4. R2: сначала **включите R2** в Dashboard (R2 → Enable). Затем  
   `npx wrangler r2 bucket create kar-card-images` и раскомментируйте `[[r2_buckets]]` в [`wrangler.toml`](../wrangler.toml) (binding `CARD_IMAGES`). Без этого деплой с binding падает, upload отдаёт 503.
5. Pages Secret: **`SYNC_JWT_SECRET`** (случайная строка ≥32 символов) — JWT sync + подпись `/api/files`
6. Деплой: GitHub Action на `main` **или** `npm run pages:deploy`
7. Build (Connect to Git): command `node scripts/generate-config.js && npm run build:bundle`, output `dist`
8. Опц. Secrets: `GEMINI_*` / `GROQ_*` / `SUPADATA_*`, stock keys, `AZURE_TRANSLATOR_*`

**Не нужны:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

Локально:

```bash
npm run pages:dev   # Pages + KV + D1 + R2 (нужен `.dev.vars` с SYNC_JWT_SECRET)
npm run dev         # http://localhost:8080 — dev-сервер + functions/api
```

Локальный CF sync: файл `.dev.vars` с `SYNC_JWT_SECRET` (≥32 символов). Секция `[ai]` в wrangler.toml по умолчанию выключена, чтобы `pages:dev` не требовал Cloudflare login; перевод без AI — HTTP-фолбэки. AI binding можно добавить в Dashboard или раскомментировать в wrangler.toml.

Порядок локально: сначала `npm run d1:migrate`, затем `npm run pages:dev`. Если register падает с `no such table: cf_users` — снова `npm run d1:migrate` и перезапустите `pages:dev` (иногда Miniflare создаёт пустую D1 до миграции).

Прод-инфра одной командой после `npx wrangler login`:

```bash
bash scripts/cf-infra-setup.sh
```

Затем в Dashboard: R2 binding `CARD_IMAGES` → `kar-card-images` и Secret `SYNC_JWT_SECRET`.

### Bindings (wrangler.toml)

| Binding | Тип | Назначение |
|---------|-----|------------|
| `YT_JOBS` | KV | YouTube jobs + rate limits |
| `SYNC_DB` | D1 | CF sync users + snapshots |
| `CARD_IMAGES` | R2 | Приватные картинки карточек |
| `AI` | Workers AI | перевод (опц.) |

---

## Данные пользователя

- **По умолчанию:** IndexedDB на устройстве (`LocalStore`).
- **Мультиустройство:** Настройки → Cloudflare sync (register/login → push/pull).
- **Картинки при CF login:** upload в R2 через `POST /api/files`, в карточках хранится `r2:userId/…`.
- **Миграция со старого Supabase:** экспорт JSON → локальный импорт → CF sync. Автомоста нет.

---

## GitHub Pages

Только статика — **без** `/api/*`. Для полного стека нужен Cloudflare Pages.

> PWA и камера требуют **HTTPS**.
