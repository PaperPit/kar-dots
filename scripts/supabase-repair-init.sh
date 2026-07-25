#!/usr/bin/env bash
# Однократно: отметить уже применённые миграции в облаке
# (если схему накатывали через SQL Editor вручную).
# Передайте номера миграций аргументами или оставьте дефолт 0001–0010.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI не установлен. См. supabase/SETUP.md"
  exit 1
fi
if [[ $# -gt 0 ]]; then
  supabase migration repair --status applied --linked "$@"
else
  supabase migration repair --status applied --linked \
    0001 0002 0003 0004 0005 0006 0007 0008 0009 0010
fi
echo "Готово. Проверка: npm run db:status"
