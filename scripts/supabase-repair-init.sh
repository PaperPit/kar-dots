#!/usr/bin/env bash
# Однократно: отметить миграции 0001–0005 как уже применённые в облаке
# (если схему накатывали через SQL Editor / supabase_schema.sql).
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI не установлен. См. supabase/SETUP.md"
  exit 1
fi
supabase migration repair --status applied --linked 0001 0002 0003 0004 0005
echo "Готово. Проверка: npm run db:status"
