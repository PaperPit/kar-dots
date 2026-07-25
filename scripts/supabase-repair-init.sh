#!/usr/bin/env bash
# Отметить миграции как применённые БЕЗ их выполнения.
#
# Нужен ровно один сценарий: схему 0001–0008 накатывали вручную через SQL Editor
# до появления supabase/migrations, и историю надо привести в соответствие.
#
# ОПАСНО: `supabase migration repair --status applied` НЕ выполняет SQL. Он
# только пишет в таблицу истории «эта версия применена». Если отметить так
# миграцию, которой в базе нет, `npm run db:status` покажет зелёный проект,
# а политик/таблиц в нём не будет. Именно поэтому 0009 и 0010 (политики RLS
# для card_images и boxes) в дефолтный диапазон НЕ входят — их надо накатывать
# через `npm run db:push`.
#
# Использование:
#   npm run db:repair-init -- --yes            # дефолтный диапазон 0001–0008
#   npm run db:repair-init -- --yes 0003 0004  # только указанные версии
#   npm run db:repair-init                     # только показать план, ничего не делать

set -euo pipefail
cd "$(dirname "$0")/.."

# Только исходный init-диапазон. Новые миграции сюда не дописывать —
# их место в `supabase db push`.
DEFAULT_VERSIONS=(0001 0002 0003 0004 0005 0006 0007 0008)

CONFIRMED=0
VERSIONS=()
for arg in "$@"; do
  case "$arg" in
    --yes|--confirm)
      CONFIRMED=1
      ;;
    -h|--help)
      echo "Использование: bash scripts/supabase-repair-init.sh --yes [версии…]"
      exit 0
      ;;
    -*)
      echo "Неизвестный флаг: $arg" >&2
      exit 2
      ;;
    *)
      if [[ ! "$arg" =~ ^[0-9]{4}$ ]]; then
        echo "Версия миграции должна быть из 4 цифр, получено: $arg" >&2
        exit 2
      fi
      VERSIONS+=("$arg")
      ;;
  esac
done

if [[ ${#VERSIONS[@]} -eq 0 ]]; then
  VERSIONS=("${DEFAULT_VERSIONS[@]}")
fi

echo "!!! ВНИМАНИЕ !!!"
echo "Команда НЕ выполняет SQL миграций. Она только помечает версии как"
echo "применённые в истории миграций Supabase. Если этих объектов нет в базе,"
echo "проект будет выглядеть мигрированным, оставаясь без таблиц и политик RLS."
echo
echo "Будут помечены как applied (--linked, текущий связанный проект):"
for v in "${VERSIONS[@]}"; do
  file=$(ls "supabase/migrations/${v}_"*.sql 2>/dev/null | head -n 1 || true)
  echo "  - ${v}  ${file:-(файл миграции не найден!)}"
done
echo

if [[ $CONFIRMED -ne 1 ]]; then
  echo "Ничего не сделано: нужен явный флаг подтверждения."
  echo "Повторите: npm run db:repair-init -- --yes"
  echo "Если миграции ещё НЕ накатаны — вам нужен npm run db:push, а не repair."
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI не установлен. См. supabase/SETUP.md" >&2
  exit 1
fi

supabase migration repair --status applied --linked "${VERSIONS[@]}"

echo "Готово. Проверка: npm run db:status"
echo "Напоминание: миграции вне диапазона (0009+) накатывайте через npm run db:push."
