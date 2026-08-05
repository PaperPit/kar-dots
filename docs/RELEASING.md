# Releasing KAR-dots

1. Update [CHANGELOG.md](../CHANGELOG.md) — move items under `## [Unreleased]` into a new `## [X.Y.Z] - YYYY-MM-DD` section.
2. Bump `APP_VERSION` / `APP_VERSION_SHORT` in [`js/core/version.ts`](../js/core/version.ts) if the client cache/SW should invalidate.
3. Merge to `main` with green CI.
4. Tag and push:

```bash
git checkout main
git pull origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

5. GitHub Actions [`.github/workflows/release.yml`](../.github/workflows/release.yml) creates a Release from the matching CHANGELOG section.

First public tag after the maturity work: **v0.2.0**.
