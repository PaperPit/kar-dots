# HTTP API — Cloudflare Pages Functions

All routes live under `functions/api/` and share [`_middleware.js`](../functions/api/_middleware.js):

- Max body **256 KB**
- Optional `Authorization: Bearer <supabase access token>` (verified; bad token → 401)
- Anonymous allowed (subject = IP + `X-Client-Id`) with stricter IP budgets
- Per-endpoint hourly rate limits in KV (`YT_JOBS` binding)
- Response `429` + `Retry-After` when limited

Base URL: same origin as the PWA (e.g. `https://kar-tochki.pages.dev/api/...`).

---

## `POST /api/yt-video`

Fetch YouTube metadata + transcript via **Supadata** (client BYOK).

**Body (JSON):**

| Field            | Required | Description                       |
| ---------------- | -------- | --------------------------------- |
| `url`            | yes      | YouTube watch/shorts URL          |
| `supadataApiKey` | yes      | User’s Supadata key from Settings |

**Success:** `{ video, transcript }` or `{ pending, jobId, video }` for long jobs.

**`GET /api/yt-video?jobId=…`:** poll job (scoped to middleware subject).

Limits: ~20 req/hour/subject; video duration ≤ 20 minutes.

---

## `POST /api/yt-generate`

LLM card generation from a prepared transcript (Gemini or Groq BYOK).

**Body (JSON):** video + transcript + mode (`words` | `phrases` | `both` | `sentences`) + API keys from settings.

**Success:** `{ cards: [...] }` (front/back candidates).

Limits: ~20 req/hour/subject.

---

## `POST /api/tts`

Optional neural TTS (Orpheus / Groq path). Requires user TTS key in settings when used.

Limits: ~40 req/hour/subject.

---

## `POST /api/stock-search`

Stock image/GIF search (Openverse / Pixabay / Giphy keys from settings).

Limits: ~120 req/hour/subject; anonymous IP ceiling still applies (~300/hour).

---

## `POST /api/translate`

Same-origin proxy for card-editor «Перевести» (CSP-safe).

**Upstream (prod):**

1. **Gemini BYOK** — если в теле есть `geminiApiKey` (Настройки → YouTube)
2. Workers AI m2m100, затем Llama (транслит onion→«Онеон» отбрасывается)
3. **Azure Translator** — если в окружении Pages задан секрет `AZURE_TRANSLATOR_KEY`
   (опционально `AZURE_TRANSLATOR_REGION`); квота держится за ключом проекта,
   а не за IP edge-узла Cloudflare, поэтому не гаснет вместе с gtx/MyMemory
4. Lingva → Google gtx → MyMemory — без ключа, последний шанс

**Body (JSON):** `text` (required), `dir` (`ru-en`|`en-ru`), optional `geminiApiKey`

**Success:** `{ text, dir, provider?: "gemini" \| "workers-ai-llm" \| "workers-ai-m2m" \| "azure" \| "lingva" \| "gtx" \| "mymemory" }`

Если перевод нестабилен — добавь ключ Gemini в настройках (тот же, что для YouTube)
или заведи `AZURE_TRANSLATOR_KEY` в Cloudflare Pages → Settings → Environment variables (Secret).

Limits: ~120 req/hour/subject.

---

## Cloudflare sync (phase 2)

Optional multi-device backup for **local-first** mode. Requires D1 binding `SYNC_DB` and secret `SYNC_JWT_SECRET` on Pages.

### `POST /api/auth/register`

**Body:** `{ email, password }` (password ≥ 8 chars)

**Success:** `{ token, email, userId }` — JWT (`iss: kar-cf-sync`, 30 days)

### `POST /api/auth/login`

**Body:** `{ email, password }`

**Success:** same as register

### `GET /api/sync/pull?since=<ms>`

**Auth:** `Authorization: Bearer <cf-sync-jwt>` (required)

**Success:** `{ updated_at, payload|null, client_id? }` — full export JSON v3 when `updated_at > since`

### `POST /api/sync/push`

**Auth:** required CF sync JWT

**Body:** `{ payload: <export v3>, base_updated_at?: number|null }`

**Success:** `{ updated_at, ok: true }`

**409 conflict:** `{ error: "conflict", updated_at, payload }` when `base_updated_at` ≠ server watermark

Limits: register ~10/h, login ~30/h, pull ~60/h, push ~30/h per subject.

---

## Cloudflare files / R2 (phase 3)

Private card images. Requires R2 binding `CARD_IMAGES` and `SYNC_JWT_SECRET`.

### `POST /api/files`

**Auth:** CF sync JWT (required)

**Body:** raw image bytes (`Content-Type: image/jpeg|png|webp|gif`), max 2 MB

**Success:** `{ key, ref: "r2:…", url: "/api/files?key=…&exp=…&sig=…", exp }`

### `GET /api/files?key=&exp=&sig=`

Signed download for `<img src>` (HMAC, TTL ~1h). No Authorization header needed when signature is valid.

### `GET /api/files?key=&sign=1`

**Auth:** CF sync JWT, key must be owned by user → fresh signed `{ url, exp, ref }`

Limits: ~60 req/hour/subject. Body size for upload: 2 MB (middleware scope `files`).

---

## Errors

JSON body typically `{ error: string, code?: string }`. Common statuses: `400`, `401`, `413`, `429`, `502` (upstream).

There is **no global auth gate** on `/api/*` by design (local/demo users). Harden public demos with Cloudflare WAF / lower limits — see [SECURITY.md](./SECURITY.md).
