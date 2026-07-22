# Деплой КАР-точек

> **Для пользователей:** пошаговая инструкция «с нуля» — деплой, компьютер, телефон, Supabase, друзья:  
> **[USER-GUIDE.md](./USER-GUIDE.md)**

Этот файл — технические детали для админов инстанса (Functions, миграции, troubleshooting).

## Сценарии

| Кому | Деплой | Supabase |
|------|--------|----------|
| Только вы, один браузер | не обязателен — `index.html` локально | нет |
| Вы, PWA на телефоне | Netlify / Pages / VPS | нет (экспорт JSON) |
| Вы + друзья с аккаунтами | ваш HTTPS-URL | **ваш** проект Supabase |

---

## Статический хостинг

Подойдёт любой HTTPS-хостинг: **Cloudflare Pages** (рекомендуется), **Netlify**, **GitHub Pages**, свой VPS (nginx/apache).

### Cloudflare Pages + Functions (рекомендуется)

Статика из `dist/` + API в `functions/api/*` (`/api/yt-video`, `/api/yt-generate`, `/api/tts`, `/api/stock-search`, `/api/yt-transcribe`). YouTube-джобы хранятся в Workers KV (`YT_JOBS`).

1. Аккаунт на [dash.cloudflare.com](https://dash.cloudflare.com), CLI: `npx wrangler login`
2. KV: `npx wrangler kv namespace create YT_JOBS` → подставить `id` в [`wrangler.toml`](../wrangler.toml)
3. **Workers & Pages → Create → Pages → Connect to Git** (репозиторий) **или** `npm run pages:deploy`
4. Build settings:
   - Framework preset: None
   - Build command: `node scripts/generate-config.js && npm run build:bundle`
   - Build output directory: `dist`
5. Environment variables (Settings → Variables):

| Переменная | Тип | Зачем |
|---|---|---|
| `SUPABASE_URL` | plain | сборка `js/config.js` |
| `SUPABASE_ANON_KEY` | plain | сборка `js/config.js` (публичный, защищён RLS) |
| `GEMINI_API_KEY` | secret | генерация карточек |
| `GROQ_API_KEY` | secret | резерв LLM + Whisper + TTS |
| `GEMINI_MODEL`, `GROQ_MODEL` | plain (опц.) | переопределить модели |
| `SUPADATA_API_KEY` | secret (опц.) | фоллбэк транскрипта |
| `PIXABAY_API_KEY`, `GIPHY_API_KEY` | plain (опц.) | стоковые картинки |

6. Functions → KV namespace bindings → `YT_JOBS` (тот же namespace, что в `wrangler.toml`)

Локально (эмуляция Pages + KV):

```bash
# ключи в .dev.vars (не коммитить)
npm run pages:dev
```

Обычный `npm run dev` по-прежнему поднимает старый Netlify-совместимый API из `netlify/functions/` (запасной путь).

### Netlify Drop (~1 минута)

1. https://app.netlify.com/drop — перетащите папку проекта
2. Получите URL вида `https://имя.netlify.app`
3. Обновление: повторный deploy той же папки

### GitHub Pages

1. Settings → Pages → Source: branch `main`, folder `/` (root)
2. Для custom domain — настройте DNS у регистратора

### Netlify + Functions (legacy / запасной)

Пока Cloudflare не проверен end-to-end, Netlify остаётся запасным деплоем:

1. Подключите репозиторий к Netlify
2. Build command: `node scripts/generate-config.js && npm run build:bundle` (см. `netlify.toml`)
3. Publish directory: `dist`
4. Functions: `netlify/functions/`
5. Переменные окружения — см. [youtube-import-setup.md](./youtube-import-setup.md)

> PWA и камера требуют **HTTPS** — перечисленные платформы выдают его автоматически.

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
```

**Вариант B — один файл**

Вставьте и выполните `supabase_schema.sql` (должен соответствовать актуальным миграциям).

### 3. Ключи в приложении

**Settings → API Keys** → скопируйте Project URL и **anon public** key.

`js/config.js`:

```js
window.KAR_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',
};
```

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
