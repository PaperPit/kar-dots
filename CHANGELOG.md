# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
