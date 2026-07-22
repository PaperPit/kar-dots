# YouTube → Flashcards Pipeline

Architecture and processing logic for converting YouTube videos into English vocabulary flashcards. Designed for MVP-first development with a clear path to scale.

> **Scope:** English source audio/captions → vocabulary cards with CEFR tags, examples, timestamps, and optional Russian (or other) translations.

---

## Overview

```
Frontend (React + Next.js)
         │
         ▼
   Paste YouTube URL
         │
         ▼
   Backend API (Node.js)
         │
         ▼
   Fetch video metadata + caption tracks
         │
    ┌────┴────┐
    ▼         ▼
 Captions   No captions
 available
    │         │
    ▼         ▼
 Parse      Download audio (yt-dlp)
 captions       │
    │           ▼
    │      faster-whisper (local)
    │           │
    └─────┬─────┘
          ▼
   Timed transcript (segments)
          │
          ▼
   Sentence segmentation (spaCy)
          │
          ▼
   NLP + vocabulary extraction
          │
          ▼
   Card generation (JSON)
          │
          ▼
   SQLite → PostgreSQL (Prisma)
          │
          ▼
   Learning UI (КАР-точки or dedicated app)
```

**Important:** Whisper runs **only** on the no-captions branch. If captions exist, skip transcription entirely — faster and free.

---

## Frontend

**Recommended stack (free, production-ready):**

| Tool | Role |
|------|------|
| Next.js 15+ (App Router) | Route Handlers, SSR, shared types |
| TypeScript | End-to-end type safety |
| Tailwind CSS | Layout and styling |
| shadcn/ui | Accessible UI components |
| Framer Motion | Card flip, swipe, progress animations |
| TanStack Query | Job polling, cache, retry |

### User flow

1. User pastes a YouTube URL.
2. Frontend validates URL (Zod) and sends `POST /api/videos/import`.
3. UI polls job status until `ready` or `failed`.
4. User previews cards, edits/removes items, imports into a folder/deck.

### Job polling (TanStack Query)

```tsx
const { data: job } = useQuery({
  queryKey: ['import-job', jobId],
  queryFn: () => fetch(`/api/jobs/${jobId}`).then(r => r.json()),
  refetchInterval: (q) =>
    q.state.data?.status === 'ready' || q.state.data?.status === 'failed'
      ? false
      : 1500,
});
```

### Key screens

| Screen | Purpose |
|--------|---------|
| **Import** | URL, source language, target translation language |
| **Job status** | Step indicator, % progress, retry on failure |
| **Preview** | Cards with CEFR badge, example sentence, timestamp link |
| **Deck settings** | CEFR range filter, phrasal verbs on/off, dedup rules |

Timestamp link format: `https://youtube.com/watch?v={id}&t={Math.floor(timestampSec)}`

---

## Backend

### MVP: Next.js Route Handlers

```
app/api/videos/import/route.ts    → validate URL, create job, enqueue work
app/api/jobs/[id]/route.ts        → return { status, step, progress, error? }
app/api/decks/[id]/cards/route.ts → preview CRUD before import
```

**Enqueue pattern — respond fast, process elsewhere:**

```ts
// app/api/videos/import/route.ts
import { after } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { url } = await request.json();
  const job = await createJob(url); // SQLite write

  // after() is fine for short tasks (logging, webhooks).
  // Do NOT run yt-dlp / Whisper inside after() on serverless — see below.
  after(async () => {
    await notifyWorker(job.id);
  });

  return Response.json({ jobId: job.id }, { status: 202 });
}
```

### Where to run heavy work

| Environment | Approach |
|-------------|----------|
| **Local dev** | Separate Node worker process + optional Python sidecars |
| **Self-hosted VPS** | Same worker on same machine; write temp audio to disk |
| **Serverless (Cloudflare Pages Functions и аналоги)** | Workers/KV; без жёсткого 10s-таймаута Netlify; для Whisper — `waitUntil` |

For MVP, plan a **dedicated worker** from day one:

- **BullMQ + Redis** (production) or in-memory queue (local only)
- Worker spawns **yt-dlp** and calls **Python faster-whisper / spaCy** services

Next.js `after()` is useful for analytics/logging after response — not for 5–30 minute transcription jobs.

### Scale path

When the project grows:

- Migrate API to **NestJS** modules: `VideoModule`, `TranscriptionModule`, `NlpModule`, `DeckModule`
- Keep the same job contract + Zod schemas so the frontend stays unchanged
- Consider **prisma-queue** (PostgreSQL `SKIP LOCKED`) instead of Redis if you want DB-only infra

---

## Database

### MVP: SQLite via Prisma

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum JobStatus {
  queued
  fetching_metadata
  fetching_captions
  parsing_captions
  downloading_audio
  transcribing
  segmenting
  analyzing
  generating_cards
  ready
  failed
}

enum CardKind {
  word
  phrase
  entity
}

model ImportJob {
  id          String    @id @default(cuid())
  youtubeId   String
  url         String
  status      JobStatus @default(queued)
  step        String?   // human-readable current step
  progress    Int       @default(0) // 0–100
  error       String?
  sourceLang  String    @default("en")
  targetLang  String    @default("ru")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  video       Video?
}

model Video {
  id          String      @id @default(cuid())
  jobId       String      @unique
  youtubeId   String      @unique
  title       String?
  durationSec Float?
  job         ImportJob   @relation(fields: [jobId], references: [id])
  transcript  Transcript?
  deck        Deck?
}

model Transcript {
  id        String @id @default(cuid())
  videoId   String @unique
  text      String
  source    String // "captions" | "whisper"
  segments  Json   // [{ start, end, text, words? }]
  video     Video  @relation(fields: [videoId], references: [id])
}

model Deck {
  id        String @id @default(cuid())
  videoId   String @unique
  title     String
  cards     Card[]
  video     Video  @relation(fields: [videoId], references: [id])
}

model Card {
  id           String   @id @default(cuid())
  deckId       String
  front        String
  back         String
  description  String?
  cefr         String?
  pos          String?
  example      String?
  timestampSec Float?
  frequency    Float?
  kind         CardKind @default(word)
  deck         Deck     @relation(fields: [deckId], references: [id])

  @@unique([deckId, front])
  @@index([deckId, cefr])
}
```

**Notes (Prisma):**

- `Json` segments are schemaless — adding fields (e.g. `words`) does not require a migration
- `@@unique([deckId, front])` enforces deduplication at DB level
- Switch `provider = "postgresql"` later; schema stays the same

Newer Prisma versions may use `prisma.config.ts` for schema/migrations paths — keep `DATABASE_URL` in `.env`.

---

## Video & transcript acquisition

Strategy: **prefer captions → fall back to audio + Whisper**.

### Branch A — captions exist (cheap, fast)

Libraries:

| Library | When to use |
|---------|-------------|
| [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript) | Quick MVP; simple API |
| [`youtubei.js`](https://github.com/LuanRT/YouTube.js) | Production — more stable when YouTube changes internals; full track listing |

Steps:

1. Parse video ID from URL (`watch?v=`, `youtu.be/`, `shorts/`).
2. List caption tracks: manual vs auto-generated, language code.
3. Prefer **manual English (`en`)** → **auto English (`en`)** → other languages (optional translate later).
4. Download segments with `{ start, duration/text, text }`.
5. Normalize to `{ start, end, text }` → store as `Transcript.segments`, `source: "captions"`.
6. **Skip Whisper.**

Cost: ~free. Latency: seconds.

Optional yt-dlp shortcut (when API libraries fail):

```bash
yt-dlp --write-subs --write-auto-subs --sub-lang en --skip-download \
  -o "%(id)s" "https://youtube.com/watch?v=VIDEO_ID"
```

### Branch B — no captions

1. Download **audio only**:

```bash
yt-dlp -x --audio-format wav --audio-quality 0 \
  -o "/tmp/%(id)s.%(ext)s" \
  "https://youtube.com/watch?v=VIDEO_ID"
```

2. Send WAV/MP3 to faster-whisper worker.
3. Store segments with timestamps, `source: "whisper"`.
4. Delete temp file after success.

Guardrails for MVP:

- Max duration: **15–30 min** (configurable)
- Sandboxed worker (subprocess, temp dir cleanup)
- Respect YouTube ToS and rate limits

---

## Speech recognition (faster-whisper)

**Recommended:** [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — local, no OpenAI API, ~4× faster than original Whisper via CTranslate2.

### Model selection

| Model | Use case |
|-------|----------|
| `large-v3` | Best quality (GPU or strong CPU) |
| `medium` | Good balance for MVP on CPU |
| `turbo` | Fastest large-model variant when available |
| `small` | Low-resource dev machines |

### Reference implementation

```python
from faster_whisper import WhisperModel

# GPU
model = WhisperModel("large-v3", device="cuda", compute_type="float16")

# CPU — lower memory
# model = WhisperModel("medium", device="cpu", compute_type="int8")

segments, info = model.transcribe(
    "/tmp/VIDEO_ID.wav",
    language="en",              # skip auto-detect for English content
    task="transcribe",
    beam_size=5,
    vad_filter=True,            # strip silence — faster, cleaner segments
    word_timestamps=True,       # needed for precise ?t= links
)

# Transcription is lazy — materialize before returning JSON
segments = list(segments)

output = []
for seg in segments:
    item = {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
    if seg.words:
        item["words"] = [
            {"start": w.start, "end": w.end, "word": w.word, "prob": w.probability}
            for w in seg.words
        ]
    output.append(item)

print(f"lang={info.language} prob={info.language_probability:.2f} dur={info.duration:.1f}s")
```

Integration: Node worker → HTTP call to FastAPI sidecar **or** spawn Python subprocess → write JSON → Prisma update.

---

## Sentence segmentation

Input: timed caption or Whisper segments.

1. **Merge** short caption chunks into sentences (punctuation + max gap heuristic, e.g. 1.5s pause).
2. **Split** with spaCy `sentencizer` (fast, no full model) or model-based boundaries for noisy auto-captions.
3. Attach **timestamp** = `start` of first segment in sentence; `end` = last segment end.

```json
{
  "sentences": [
    {
      "text": "The company has been struggling with cash flow.",
      "start": 42.1,
      "end": 45.8
    }
  ]
}
```

---

## NLP pipeline (no LLM on v1)

Use **spaCy** — start with `en_core_web_sm` (MVP), upgrade to `en_core_web_md` / `en_core_web_lg` for better lemmatization.

### Per-sentence pipeline

```
tokenize → POS tag → lemmatize → extract phrases (Matcher) → NER (optional)
    → stopword filter → wordfreq rank → CEFR tag → score
```

### Example

```
The company has been struggling with cash flow.
```

After filters:

```
company · struggle · cash flow   ← "cash flow" as phrase, not split
```

### Stopwords & frequency

- spaCy `STOP_WORDS` + custom list (`been`, `has`, …)
- **wordfreq** Zipf score: drop ultra-common tokens (Zipf > 6.0), rank deck by ascending frequency (rarer = more interesting)

### CEFR level

| Source | Usage |
|--------|-------|
| [english-words-cefr](https://github.com/MaximVan/english-words-cefr) | Direct A1–C1 mapping |
| wordfreq | Fallback when word not in CEFR list |

Rules:

- Known CEFR → use it
- Unknown + high Zipf → A2/B1
- Unknown + low Zipf → B2+
- User filter: e.g. deck only includes A2–B2

### Phrase & phrasal verb extraction (critical)

Do **not** split:

- *take care of · look forward to · come up with · cash flow*

Tools:

- **spaCy Matcher** — `[{"LOWER": "come"}, {"LOWER": "up"}, {"LOWER": "with"}]`
- **Textacy** — keyterm / n-gram helpers for multi-word expressions

Priority order:

1. Match phrasal / collocation patterns → one **phrase** card
2. Remove tokens covered by phrase spans
3. Remaining content lemmas → **word** cards
4. NER entities → optional **entity** cards (opt-in in UI)

```json
{
  "kind": "phrase",
  "front": "come up with",
  "pos": "phrasal_verb",
  "example": "We need to come up with a better plan.",
  "timestampSec": 120.4
}
```

### Card scoring (rank before preview)

Combine signals to sort preview list:

```
score = w1 * (7 - zipf) + w2 * cefr_weight + w3 * phrase_bonus - w4 * repeat_penalty
```

Show top N cards by default (e.g. 30); user expands full list.

---

## Definitions & translations (no LLM v1)

### English definitions

| Source | Role |
|--------|------|
| **WordNet** (NLTK) | Short gloss for single lemmas |
| **Wiktionary API** | Idioms, phrasal verbs, extra senses |

Pick first sense matching POS from spaCy tag.

### Translations (e.g. Russian)

| Tool | Mode |
|------|------|
| **Argos Translate** | Fully local, offline — best for privacy |
| **LibreTranslate** | Self-hosted Docker instance |

```
lemma/phrase → WordNet gloss (EN, description field)
             → Argos en→ru (back field)
```

Cache translations in DB (`front + targetLang → back`) to avoid re-translating duplicates across videos.

### LLM (optional v2)

Use only when:

- Sense disambiguation (*bank*, *run*, *light*)
- Simplifying example sentences to target CEFR
- Mnemonics / usage notes

Keep v1 **deterministic and auditable**.

---

## Card generation (JSON)

Output compatible with КАР-точки import:

```json
{
  "deck": {
    "title": "Cash flow basics — YouTube abc123",
    "source": {
      "youtubeId": "abc123",
      "url": "https://youtube.com/watch?v=abc123",
      "timestampBase": "https://youtube.com/watch?v=abc123&t="
    }
  },
  "cards": [
    {
      "front": "cash flow",
      "back": "денежный поток",
      "description": "The movement of money in and out of a business.",
      "cefr": "B2",
      "pos": "noun",
      "kind": "phrase",
      "example": "The company has been struggling with cash flow.",
      "timestampSec": 42.1,
      "frequency": 4.2
    },
    {
      "front": "struggle",
      "back": "испытывать трудности",
      "description": "To try very hard to do something difficult.",
      "cefr": "B2",
      "pos": "verb",
      "kind": "word",
      "example": "The company has been struggling with cash flow.",
      "timestampSec": 42.1,
      "frequency": 5.1
    }
  ]
}
```

### Deduplication

- One card per `(deckId, front)` — DB unique constraint
- Prefer **phrase** over word if both match (*cash flow* ⊃ *cash*, *flow*)
- Keep best **example**: clearest sentence, or earliest timestamp with full context

---

## Job state machine

```
queued
  → fetching_metadata
  → fetching_captions
      ├─ (found)  → parsing_captions ──┐
      └─ (missing) → downloading_audio → transcribing ──┘
  → segmenting
  → analyzing
  → generating_cards
  → ready

failed (retryable | permanent)
```

Persist `progress` (0–100) and `step` on each transition for TanStack Query polling.

Retryable errors: network timeout, yt-dlp rate limit, Whisper OOM → retry with smaller model.

Permanent errors: video private/deleted, unsupported URL, duration exceeds limit.

---

## Suggested repo layout

```
apps/
  web/                    # Next.js (UI + Route Handlers)
packages/
  db/                     # Prisma schema + client
  shared/                 # Zod schemas, types, constants
services/
  worker/                 # BullMQ consumer (Node)
  whisper/                # FastAPI + faster-whisper
  nlp/                    # FastAPI + spaCy + wordfreq + CEFR
```

Shared Zod schema example:

```ts
import { z } from 'zod';

export const ImportRequest = z.object({
  url: z.string().url(),
  sourceLang: z.string().default('en'),
  targetLang: z.string().default('ru'),
  maxCards: z.number().int().min(5).max(200).default(50),
  cefrMin: z.enum(['A1','A2','B1','B2','C1']).optional(),
  cefrMax: z.enum(['A1','A2','B1','B2','C1']).optional(),
});
```

---

## MVP scope vs later

| MVP | Later |
|-----|-------|
| SQLite + Prisma | PostgreSQL + full-text search |
| Next.js Route Handlers + external worker | NestJS services |
| Captions first, yt-dlp + Whisper fallback | Playlist / channel import |
| spaCy + wordfreq + CEFR | LLM disambiguation |
| Argos Translate (local) | User dictionary + DeepL optional |
| Preview + JSON export | Direct sync to КАР-точки cloud |
| Single user / local | Auth, quotas, billing |

---

## Risks & constraints

| Risk | Mitigation |
|------|------------|
| YouTube ToS / API changes | Prefer caption APIs; abstract fetcher behind interface |
| `youtube-transcript` breakage | Fallback to youtubei.js or yt-dlp subs |
| Auto-caption noise | Offer "Re-transcribe with Whisper" toggle |
| Serverless timeouts | Never run heavy pipeline in Route Handler; use worker |
| Proper noun clutter | NER cards off by default |
| Long videos | Duration cap; chunk Whisper by VAD segments |
| Translation quality | Show EN definition + RU back; allow user edit in preview |

---

## References

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — `after()`, serverless limits
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — models, VAD, word timestamps
- [spaCy Matcher](https://spacy.io/usage/rule-based-matching)
- [Prisma](https://www.prisma.io/docs) — SQLite, Json fields, migrations
- [TanStack Query](https://tanstack.com/query) — polling patterns
- [wordfreq](https://github.com/rspeer/wordfreq)
- [english-words-cefr](https://github.com/MaximVan/english-words-cefr)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [youtube-transcript](https://www.npmjs.com/package/youtube-transcript) / [youtubei.js](https://github.com/LuanRT/YouTube.js)
- [Argos Translate](https://github.com/argosopentech/argos-translate) / [LibreTranslate](https://libretranslate.com/)
