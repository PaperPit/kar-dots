# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Settings sync queue / dead-letter UI (retry, discard, sync now)
- Anki `.apkg` import (notes → Front/Back cards; no media / scheduling)
- Vitest coverage gates for cloud store + review grading
- Dependabot (npm + GitHub Actions) and tag-based release workflow
- Root `SECURITY.md` and `docs/SECURITY.md` (threat model, BYOK, rotation)

### Changed

- Review a11y: `aria-live` feedback, labelled grade group, toast roles
- Migration docs aligned with current `REQUIRED_SCHEMA_VERSION`

## [0.1.0] - 2026-07-01

### Added

- Initial public self-hosted PWA baseline (SRS, cloud sync, YouTube import, Chrome extension)
