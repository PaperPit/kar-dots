#!/usr/bin/env bash
# Пересоздать ios/ с Swift Package Manager (без CocoaPods).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -d ios ]]; then
  echo "Удаляю ios/ (старый CocoaPods-проект)…"
  rm -rf ios
fi

npm run ios:prepare
npx cap add ios --packagemanager SPM
node scripts/patch-ios-plist.js
npx cap sync ios
node scripts/patch-ios-plist.js

echo ""
echo "Готово. Дальше:"
echo "  npm run ios:open"
echo "  В Xcode: Package Dependencies → + → Add Local → ios/App/CapApp-SPM"
echo "  Info → Debug → debug.xcconfig (см. docs/IOS.md)"
