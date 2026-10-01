#!/usr/bin/env bash
# Прод-инфра Cloudflare для КАР-точки (D1 + R2).
# Требует: npx wrangler login  ИЛИ  export CLOUDFLARE_API_TOKEN=...
set -euo pipefail
cd "$(dirname "$0")/.."

if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "Не залогинены в Cloudflare."
  echo "  npx wrangler login"
  echo "или: export CLOUDFLARE_API_TOKEN=..."
  exit 1
fi

echo "==> R2 bucket kar-card-images"
if npx wrangler r2 bucket create kar-card-images; then
  echo "created"
else
  echo "(уже есть или ошибка create — проверьте wrangler r2 bucket list)"
fi

echo "==> D1 migrations (remote)"
npx wrangler d1 migrations apply kar-sync --remote

echo ""
echo "==> Дальше в Dashboard (Pages → проект):"
echo "  1. Settings → Functions → R2 bindings: CARD_IMAGES → kar-card-images"
echo "  2. Settings → Environment variables → Secret SYNC_JWT_SECRET (≥32 chars)"
echo "  3. npm run pages:deploy  (или push в main)"
echo "Done."
