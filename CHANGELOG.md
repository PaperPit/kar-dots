# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [17.0] - 2026-08-27

### Added
- Cloudflare sync (phase 2): D1 snapshot API (`/api/auth/*`, `/api/sync/push|pull`), Settings UI with login + Sync now
- Email/password accounts for optional multi-device backup (JWT via `SYNC_JWT_SECRET`)

### Changed
- Local mode: Cloudflare sync section in Settings; legacy Supabase queue UI only in cloud mode

## [16.9] - 2026-08-27

### Changed
- Local-first boot: default to local mode; Supabase cloud is legacy (collapsed on auth)
- Settings: switch to local mode to leave offline sync queue banner
- Auth CTA: continue on this device as primary action

## [16.8] - 2026-08-26

### Changed
- LLM-polish RU translations in built-in EN packs (A0/A1/A2/phrases); pack versions bumped
- Card back: optional example line after first newline (`.card-example`)

### Fixed
- Pack edge cases (may/to/will/on/of/black/aux); markdown title hyphen strip


### Changed

- (nothing yet)

## [0.2.0] - 2026-08-05

### Added

- Settings sync queue / dead-letter UI (retry, discard, sync now)
- Anki `.apkg` import (notes → Front/Back; no media / scheduling)
- Vitest coverage gates for cloud store + review grading (fixed `.ts` instrumentation)
- Dependabot, Keep a Changelog, tag-based GitHub Release workflow
- Root `SECURITY.md` + `docs/SECURITY.md`
- `docs/ARCHITECTURE.md`, `docs/API.md`, extension privacy policy
- Broader Playwright flows: classic review, offline persistence, JSON import, sync section
- Chrome extension RU/EN i18n + extension unit smoke tests

### Changed

- Review a11y: `aria-live` feedback, labelled grade group, toast roles
- CONTRIBUTING / ROADMAP refreshed for TypeScript + Cloudflare stack
- Migration docs aligned with current schema version

## [0.1.0] - 2026-07-01

### Added

- Initial public self-hosted PWA baseline (SRS, cloud sync, YouTube import, Chrome extension)
