#!/usr/bin/env python3
"""Нарезка встроенных паков на блоки по 500 карточек для LLM-полировки.

Каждая карточка — компактный кортеж [глобальный_индекс, pack, front, pos, back].
pos нормализован к английскому (как в overrides: 'noun', 'adverb, preposition').
Блоки: scripts/data/llm-blocks/block-N.json, правки: fix-N.json вида
{"front::pos": ["перевод1", "перевод2"]}.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKS = ROOT / 'packs'
OUT = ROOT / 'scripts' / 'data' / 'llm-blocks'
BLOCK_SIZE = 500

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


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    for f in ['en-a0-starters.json', 'en-a1-oxford.json', 'en-a2-oxford.json',
              'en-phrases-a0-a2.json']:
        pack = json.loads((PACKS / f).read_text())
        for c in pack['cards']:
            _, pos = c['description'].split(' · ', 1)
            entries.append({
                'pack': f,
                'front': c['front'],
                'pos': norm_pos(pos),
                'back': c['back'],
            })
    blocks = [entries[i:i + BLOCK_SIZE] for i in range(0, len(entries), BLOCK_SIZE)]
    for n, block in enumerate(blocks, 1):
        path = OUT / f'block-{n}.json'
        path.write_text(json.dumps(block, ensure_ascii=False, indent=1) + '\n')
        print(f'{path.name}: {len(block)} карточек (#{entries.index(block[0]) + 1}'
              f'–#{entries.index(block[-1]) + 1})')
    print(f'Всего: {len(entries)} карточек, {len(blocks)} блоков')


if __name__ == '__main__':
    sys.exit(main())
