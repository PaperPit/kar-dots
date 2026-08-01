#!/usr/bin/env bash
# Одноразовая установка команды kar-push в ~/.zshrc (или ~/.bashrc).
# Запуск из корня репозитория:
#   bash scripts/install-kar-push.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/kar-push.sh"
chmod +x "$SCRIPT"

SHELL_NAME="$(basename "${SHELL:-zsh}")"
if [[ "$SHELL_NAME" == "bash" ]]; then
  RC="${HOME}/.bashrc"
else
  RC="${HOME}/.zshrc"
fi

MARKER="# kar-push (КАР-точки)"
BLOCK=$(cat <<EOF
$MARKER
kar-push() {
  bash "$SCRIPT" "\$@"
}
EOF
)

touch "$RC"
if grep -qF "$MARKER" "$RC" 2>/dev/null; then
  # Обновить путь, если репо переехало
  TMP="$(mktemp)"
  awk -v marker="$MARKER" -v root="$ROOT" '
    $0 == marker { skip=1; next }
    skip && /^kar-push\(\)/ { next }
    skip && /^  bash / { next }
    skip && /^}/ { skip=0; next }
    !skip { print }
  ' "$RC" > "$TMP"
  mv "$TMP" "$RC"
fi

printf '\n%s\n' "$BLOCK" >> "$RC"

echo "✓ Установлено в $RC"
echo "  Перезагрузи shell:  source $RC"
echo "  Дальше из любой папки:  kar-push \"описание изменений\""
