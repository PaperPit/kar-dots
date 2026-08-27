#!/usr/bin/env python3
"""Накат LLM-правок (fix-N.json) на встроенные паки + version bump.

1. Читает scripts/data/llm-blocks/fix-*.json → словарь {"front::pos": [переводы]}.
2. Патчит packs/*.json: back = " / ".join(переводы[:3]).
3. Поднимает version каждого пака и manifest.json.
4. Сохраняет объединённые правки в scripts/data/ru-llm-polish.json
   (для будущих пересборок; подключается в build-vocab-packs-freedict.py).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKS = ROOT / 'packs'
BLOCKS = ROOT / 'scripts' / 'data' / 'llm-blocks'
MERGED_OUT = ROOT / 'scripts' / 'data' / 'ru-llm-polish.json'

RU_POS = {
    'сущ.': 'noun', 'гл.': 'verb', 'прил.': 'adjective', 'нар.': 'adverb',
    'предл.': 'preposition', 'союз': 'conjunction', 'мест.': 'pronoun',
    'опр.': 'determiner', 'мод.': 'modal verb', 'всп.': 'auxiliary verb',
    'арт.': 'article', 'пор.': 'ordinal number', 'межд.': 'exclamation',
    'числ.': 'number', 'infinitive': 'infinitive marker',
}


def norm_pos(desc_pos: str) -> str:
    parts = [p.strip() for p in desc_pos.split(',')]
    return ', '.join(RU_POS.get(p, p) for p in parts)


def card_key(c: dict) -> str:
    _, pos = c['description'].split(' · ', 1)
    return f"{c['front'].lower()}::{norm_pos(pos)}"


def main():
    fixes = {}
    for path in sorted(BLOCKS.glob('fix-*.json')):
        for k, v in json.loads(path.read_text()).items():
            front, _, pos = k.partition('::')
            fixes[f'{front.lower()}::{pos}'] = v
    print(f'Правок в overrides: {len(fixes)}')

    applied, missed = 0, set()
    for pack_file in sorted(PACKS.glob('en-*.json')):
        pack = json.loads(pack_file.read_text())
        changed = 0
        for c in pack['cards']:
            key = card_key(c)
            if key in fixes:
                c['back'] = ' / '.join(fixes[key][:3])
                applied += 1
                changed += 1
        # ключи, не найденные ни в одном паке, соберём после прохода
        pack['version'] = int(pack.get('version', 1)) + 1
        pack_file.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + '\n')
        print(f'{pack_file.name}: изменено {changed}, версия → {pack["version"]}')

    used = {card_key(c)
            for f in PACKS.glob('en-*.json')
            for c in json.loads(f.read_text())['cards']}
    missed = sorted(set(fixes) - used)
    if missed:
        print(f'! Правки без пары в паках ({len(missed)}): {missed[:10]}')

    manifest_file = PACKS / 'manifest.json'
    manifest = json.loads(manifest_file.read_text())
    manifest['version'] = int(manifest.get('version', 1)) + 1
    for p in manifest['packs']:
        pack = json.loads((PACKS / p['file']).read_text())
        p['version'] = pack['version']
        p['cardCount'] = len(pack['cards'])
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    print(f'manifest: версия → {manifest["version"]}')

    MERGED_OUT.write_text(json.dumps(
        {k: fixes[k] for k in sorted(fixes)}, ensure_ascii=False, indent=1) + '\n')
    print(f'Объединённые правки → {MERGED_OUT.relative_to(ROOT)}')
    print(f'Итого применено: {applied}')


if __name__ == '__main__':
    sys.exit(main())
