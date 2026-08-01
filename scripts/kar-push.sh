#!/usr/bin/env bash
# Универсальный push: deps → тесты → commit → push текущей ветки.
# Использование: kar-push "краткое описание"
# Или из репо:  npm run kar-push -- "описание"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MSG="${*:-update}"
if [[ -z "${MSG// }" ]]; then
  MSG="update"
fi

echo "→ $ROOT"

if [[ ! -d node_modules ]] || [[ ! -x node_modules/.bin/vitest ]]; then
  echo "→ npm install  (нет node_modules / vitest)"
  npm install
fi

echo "→ npm test"
npm test

git add -A
if git diff --cached --quiet; then
  echo "→ нечего коммитить (рабочее дерево чистое)"
else
  git commit -m "$MSG"
fi

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "Не на ветке (detached HEAD?) — укажи ветку вручную" >&2
  exit 1
fi

echo "→ git push origin $BRANCH"
git push -u origin "$BRANCH"
echo "✓ готово"
