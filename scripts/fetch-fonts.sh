#!/usr/bin/env bash
# ============================================================
#  КАР-точки · вендоринг шрифтов «МОДЕРНИЗМ-80»
#  Unbounded (дисплей) + Golos Text (текст), оба SIL OFL.
#
#  Запускать со своей машины (нужен интернет):
#     bash scripts/fetch-fonts.sh
#
#  Скрипт вытягивает у Google Fonts только два подмножества —
#  cyrillic и latin — и кладёт их в css/fonts/ под теми именами,
#  которые ждёт css/fonts/fonts.css.
# ============================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/css/fonts"
mkdir -p "$DIR"

# Современный woff2 отдаётся только «свежему» UA.
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

fetch() {                      # fetch <css-url> <subset> <выходной-файл>
  local url="$1" subset="$2" out="$3"
  local src
  src="$(curl -sS -A "$UA" "$url" \
        | awk -v s="/* $subset */" '$0==s{f=1} f&&/src:/{print;exit}' \
        | sed -E 's/.*url\(([^)]+)\).*/\1/')"
  if [ -z "$src" ]; then
    echo "  ✗ не нашёл подмножество $subset в $url" >&2
    return 1
  fi
  curl -sS -A "$UA" -o "$DIR/$out" "$src"
  printf '  ✓ %-26s %s\n' "$out" "$(du -h "$DIR/$out" | cut -f1)"
}

echo "Unbounded 700/800 →  $DIR"
U7='https://fonts.googleapis.com/css2?family=Unbounded:wght@700'
fetch "$U7" cyrillic unbounded-cyr.woff2
fetch "$U7" latin    unbounded-latin.woff2
U8='https://fonts.googleapis.com/css2?family=Unbounded:wght@800'
fetch "$U8" cyrillic unbounded-800-cyr.woff2
fetch "$U8" latin    unbounded-800-latin.woff2

echo "Golos Text 400/500/600 →  $DIR"
G4='https://fonts.googleapis.com/css2?family=Golos+Text:wght@400'
fetch "$G4" cyrillic golos-cyr.woff2
fetch "$G4" latin    golos-latin.woff2
G5='https://fonts.googleapis.com/css2?family=Golos+Text:wght@500'
fetch "$G5" cyrillic golos-500-cyr.woff2
fetch "$G5" latin    golos-500-latin.woff2
G6='https://fonts.googleapis.com/css2?family=Golos+Text:wght@600'
fetch "$G6" cyrillic golos-600-cyr.woff2
fetch "$G6" latin    golos-600-latin.woff2

echo
echo "Готово. Старые Baloo 2 / Nunito больше не нужны — удалите вручную:"
echo "  git rm css/fonts/baloo2-*.woff2 css/fonts/nunito-*.woff2"
