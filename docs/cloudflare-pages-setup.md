# Cloudflare Pages — настройка

Репозиторий: `https://github.com/PaperPit/kar-dots`  
Проект Pages: `kar-tochki` → URL будет `https://kar-tochki.pages.dev`

> **Важно:** привязать GitHub к Pages «Connect to Git» **через CLI нельзя** — только в [Dashboard](https://dash.cloudflare.com).  
> Через терминал: создать проект + KV + деплой; для автодеплоя по `git push` — GitHub Action (уже в репо).

---

## A. Один раз в терминале (Mac)

```bash
cd "/Users/lustinaleksej/Claude/Projects/Веб приложение Карточки"

# 1) Войти в Cloudflare (откроется браузер)
npx wrangler login

# 2) Создать проект Pages (если ещё нет)
npx wrangler pages project create kar-tochki --production-branch=main

# 3) KV для YouTube-джобов (если id ещё не в wrangler.toml)
npx wrangler kv namespace create YT_JOBS
# → вставьте id в wrangler.toml → [[kv_namespaces]] id = "..."

# 4) Первый деплой (получите глобальный URL)
npm run pages:deploy
```

После шага 4 wrangler напечатает ссылку вида `https://….pages.dev`.

### Секреты рантайма функций (CLI)

```bash
# интерактивно спросит значение
npx wrangler pages secret put GEMINI_API_KEY --project-name=kar-tochki
npx wrangler pages secret put GROQ_API_KEY --project-name=kar-tochki
npx wrangler pages secret put SUPADATA_API_KEY --project-name=kar-tochki
```

Обычные (не secret) переменные для **сборки** `config.js` удобнее в Dashboard:  
Workers & Pages → `kar-tochki` → Settings → Environment variables →  
`SUPABASE_URL`, `SUPABASE_ANON_KEY` (+ при желании PIXABAY/GIPHY).

KV-биндинг: Settings → Functions → KV namespace bindings → `YT_JOBS`.

---

## B. Автодеплой с GitHub (вместо Connect to Git)

Workflow: [`.github/workflows/deploy-cloudflare-pages.yml`](../.github/workflows/deploy-cloudflare-pages.yml)

1. Cloudflare Dashboard → **Manage account** → **Account ID** (скопировать).
2. [API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) → Create Token → шаблон **Edit Cloudflare Workers**  
   (или Custom: Account → Cloudflare Pages → Edit, Account → Account Settings → Read).
3. В GitHub: репозиторий **PaperPit/kar-dots** → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Значение |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | токен из п.2 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| `SUPABASE_URL` | ваш URL |
| `SUPABASE_ANON_KEY` | anon key |

4. Закоммитьте workflow (если ещё не в `main`) и сделайте `git push` — Action задеплоит на `kar-tochki.pages.dev`.

---

## C. Вариант Dashboard «Connect to Git» (без GitHub Action)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → **Connect to Git**
2. GitHub → `PaperPit/kar-dots`
3. Build command: `node scripts/generate-config.js && npm run build:bundle`
4. Build output directory: `dist`
5. Env + KV как выше

Тогда Cloudflare сам соберёт при каждом push (лимит ~500 сборок/мес).

---

## Локально

```bash
npm run pages:dev   # http://localhost:8788
```

Ключи: `.env` или `.dev.vars` (не коммитить).

## Чеклист после деплоя

1. Открывается `https://kar-tochki.pages.dev`
2. Вход Supabase работает
3. YouTube / TTS / stock API отвечают
4. В логах Functions нет `process is not defined`

## Чистка Netlify

После успешной проверки CF — попросите удалить `netlify/functions`, `netlify.toml` и `@netlify/blobs`.
