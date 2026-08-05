# Privacy Policy — KAR-dots Chrome extension

**Last updated:** 2026-08-05  
**Product:** Chrome extension “КАР-точки — YouTube” / “KAR-dots — YouTube”  
**Operator:** self-hosted / open-source project [PaperPit/kar-dots](https://github.com/PaperPit/kar-dots) (MIT). The official demo host is `https://kar-tochki.pages.dev`. If you build the extension against your own origin, **you** are the data controller for that instance.

## What the extension does

Creates flashcards from the YouTube video you are watching and saves them to your KAR-dots cloud account (Supabase project configured for that instance).

## Data the extension accesses

| Data | Why | Where it goes |
|------|-----|----------------|
| Active tab URL/title (YouTube) | Detect the current video | Kept in `chrome.storage.session` on your device; sent to your instance’s `/api/yt-video` only when you click Generate |
| Account session (access/refresh tokens, Supabase URL, anon key) | Save cards to your collection | `chrome.storage.local` after you connect via `?ext_connect=1` on the web app |
| Preferences (mode, folder, merge cues) | Remember UI choices | `chrome.storage.local` |
| API keys from your KAR-dots settings (Supadata, Gemini/Groq) | Fetch transcript / generate cards | Read from your cloud settings; sent to **your** `/api/*` endpoints, not to third parties by the extension itself |

The extension does **not** sell data, run ads, or send analytics/telemetry to the maintainers.

## Third parties

- **YouTube** — page you already have open (content script).
- **Your KAR-dots / Supabase instance** — auth and card writes.
- **Upstream providers you configured** (Supadata, Gemini, Groq) — called by the Cloudflare Functions on **your** deploy, using keys you provided.

## Permissions

- `storage` — session and prefs.
- `tabs` — read the active YouTube tab URL/title.
- Host permissions — YouTube, your app origin, `*.supabase.co`.

## Retention

Disconnect in the extension UI (or remove the extension) clears the stored session on the device. Cloud cards remain in your Supabase project until you delete them there.

## Contact

Security issues: [SECURITY.md](../SECURITY.md).  
Questions: [GitHub Issues](https://github.com/PaperPit/kar-dots/issues).

If you redistribute a modified build, publish your own privacy policy URL for Chrome Web Store listing.
