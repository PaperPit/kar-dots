# Cloudflare Pages — настройка

Репозиторий: `https://github.com/PaperPit/kar-dots`  
Прод upstream: **[https://kar-tochki.pages.dev](https://kar-tochki.pages.dev)**  
Проект Pages: `kar-tochki`

> Привязать GitHub к Pages «Connect to Git» через CLI нельзя — только в Dashboard.  
> Через терминал: проект + KV + деплой; автодеплой по `git push` — GitHub Action (уже в репо и работает).

---

## A. Один раз в терминале

```bash
cd kar-dots   # или путь к клону

npx wrangler login
npx wrangler pages project create kar-tochki --production-branch=main

# KV для YouTube-джобов (подставьте id в wrangler.toml)
npx wrangler kv namespace create YT_JOBS

npm run pages:deploy
```

### Переменные рантайма функций

Секреты `GEMINI_API_KEY` / `GROQ_API_KEY` / `SUPADATA_API_KEY` **не нужны**: пользователи указывают свои ключи в Настройках приложения. Без личного ключа соответствующие `/api/*` отвечают `401`.

Опционально (имена моделей, не биллинг):

```bash
npx wrangler pages secret put GEMINI_MODEL --project-name=kar-tochki   # напр. gemini-flash-latest
npx wrangler pages secret put GROQ_MODEL --project-name=kar-tochki
```

Переменные сборки (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — в GitHub Actions secrets и/или в Dashboard Pages → Environment variables.  
KV-биндинг: Settings → Functions → `YT_JOBS`.

---

## B. Автодеплой с GitHub

Workflow: [`.github/workflows/deploy-cloudflare-pages.yml`](../.github/workflows/deploy-cloudflare-pages.yml)

В GitHub → Settings → Secrets → Actions:

| Secret | Значение |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | [Create Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) → Edit Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → Account ID |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon / publishable key |

Push в `main` или Actions → **Deploy Cloudflare Pages** → Run workflow.

---

## C. Connect to Git в Dashboard (альтернатива Action)

Workers & Pages → Connect to Git → `PaperPit/kar-dots`  
Build: `node scripts/generate-config.js && npm run build:bundle` → output `dist`.

---

## Локально

```bash
npm run pages:dev   # http://localhost:8788
npm run dev         # http://localhost:8080
```

Ключи: `.env` или `.dev.vars` (не коммитить).

## Чеклист

1. Открывается `https://….pages.dev`
2. Вход Supabase / демо-режим
3. YouTube, TTS, stock API
4. В логах Functions нет `process is not defined`
