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

1. Workers AI Llama (if `AI` binding is set in Pages)
2. Workers AI m2m100 with language names `english`/`russian`
3. **Google Translate gtx** — reliable from Cloudflare edge without a key (MyMemory often returns 502 from CF IPs)
4. MyMemory last

**Success:** `{ text, dir, provider?: "workers-ai-llm" \| "workers-ai-m2m" \| "gtx" \| "mymemory" }`

If translate keeps returning 502 after deploy, add Pages → Settings → Bindings → Workers AI (`AI`), then redeploy.

Limits: ~120 req/hour/subject.

---

## Errors

JSON body typically `{ error: string, code?: string }`. Common statuses: `400`, `401`, `413`, `429`, `502` (upstream).

There is **no global auth gate** on `/api/*` by design (local/demo users). Harden public demos with Cloudflare WAF / lower limits — see [SECURITY.md](./SECURITY.md).
