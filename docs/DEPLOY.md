# Деплой КАР-точек

> **Для пользователей:** пошаговая инструкция «с нуля» — деплой, компьютер, телефон, Supabase, друзья:  
> **[USER-GUIDE.md](./USER-GUIDE.md)**

Этот файл — технические детали для админов инстанса (Functions, миграции, troubleshooting).

## Сценарии

| Кому | Деплой | Supabase |
|------|--------|----------|
| Только вы, один браузер | `npm run dev` локально | нет |
| Вы, PWA на телефоне | **Cloudflare Pages** | нет (экспорт JSON) |
| Вы + друзья с аккаунтами | **Cloudflare Pages** (`*.pages.dev`) | **ваш** проект Supabase |

**Прод upstream:** [https://kar-tochki.pages.dev](https://kar-tochki.pages.dev)

---

## Статический хостинг

Основной путь — **Cloudflare Pages** (статика `dist/` + Functions). Также возможны GitHub Pages (только UI) и свой VPS.

### Cloudflare Pages + Functions (основной)

Статика из `dist/` + API в `functions/api/*` (`/api/yt-video`, `/api/yt-generate`, `/api/tts`, `/api/stock-search`, `/api/yt-transcribe`). YouTube-джобы — Workers KV (`YT_JOBS`).

Пошагово: **[cloudflare-pages-setup.md](./cloudflare-pages-setup.md)**. Кратко:

1. `npx wrangler login`
2. KV: `npx wrangler kv namespace create YT_JOBS` → `id` в [`wrangler.toml`](../wrangler.toml)
3. Деплой: GitHub Action на `main` **или** `npm run pages:deploy`
4. Build (если Connect to Git в Dashboard):
   - command: `node scripts/generate-config.js && npm run build:bundle`
   - output: `dist`
5. Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, секреты `GEMINI_*` / `GROQ_*` / `SUPADATA_*`, опц. stock keys
6. Functions → KV binding `YT_JOBS`

Локально:

```bash
npm run pages:dev   # http://localhost:8788 — эмуляция Pages + KV
npm run dev         # http://localhost:8080 — dev-сервер + netlify/functions (legacy API)
```

### GitHub Pages

Только статика из корня — **без** `/api/*` (YouTube-импорт и серверный TTS не работают). Settings → Pages → branch `main`, folder `/`.

### Netlify (legacy)

`netlify.toml` + `netlify/functions/` ещё в репозитории как запасной путь. Новый деплой — на Cloudflare. После полной проверки CF каталог Netlify можно удалить.

> PWA и камера требуют **HTTPS**.

---

## Supabase (ваш инстанс для себя и друзей)

Без Supabase — **локальный режим** (IndexedDB), данные только в браузере.  
С Supabase на **вашем** проекте — регистрация, sync между вашими устройствами, картинки в Storage.

**Друзья:** отправьте им URL вашего деплоя. Каждый нажимает «Создать аккаунт» — коллекции **не пересекаются** (RLS: пользователь видит только своё). Вы не админ-панель, а хост приложения; лимиты — тариф **вашего** Supabase.

### 1. Создать проект

https://supabase.com → **New project** → дождаться provisioning.

### 2. Применить схему

**Вариант A — миграции (рекомендуется для новых установок)**

В **SQL Editor** выполните файлы по порядку:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_folder_icons.sql
supabase/migrations/0003_fsrs.sql
supabase/migrations/0004_boxes.sql
supabase/migrations/0005_updated_at.sql
supabase/migrations/0006_cards_updated_at_idx.sql
supabase/migrations/0007_settings_rls.sql
supabase/migrations/0008_review_log.sql
```

**Вариант B — один файл**

Вставьте и выполните `supabase_schema.sql` (должен соответствовать актуальным миграциям).

### 3. Ключи в приложении

**Settings → API Keys** → скопируйте Project URL и **anon public** key.

`js/config.js`:

```js
export default {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',
};
```

На Cloudflare Pages ключи обычно задают через env (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) — `scripts/generate-config.js` собирает `config.js` при билде.

Anon key безопасен на клиенте — доступ ограничен RLS-политиками.

### 4. Email (опционально)

Для прототипа без подтверждения почты: **Authentication → Providers → Email → Confirm email OFF**.

### 5. Перенос из локального режима

Локально: **Настройки → Экспорт → Скачать JSON**  
После входа в облако: **Импорт** того же файла.

---

## Локальная разработка

```bash
npm install
npm run dev        # http://localhost:8080 + API из netlify/functions/
npm run pages:dev  # эмуляция Cloudflare Pages (dist + functions/ + KV)
```

Перед релизом: `npm test`, при изменении списка файлов — `npm run sw:generate` и bump `VERSION` в `sw.js`.

---

## Частые проблемы

| Симптом | Решение |
|---------|---------|
| Нет колонки `icon` у папок | выполнить `0002_folder_icons.sql` |
| Нет FSRS-полей | `0003_fsrs.sql` |
| Старый Supabase без `back_desc` | `alter table public.cards add column if not exists back_desc text default '';` |
| Облако не подключается | проверить URL/key в `js/config.js`, RLS, CORS origin на Supabase |

Подробнее по YouTube: [youtube-import-setup.md](./youtube-import-setup.md).
