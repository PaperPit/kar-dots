#!/usr/bin/env python3
"""Генерация ru-translator.json через Google Translate (словарные значения по POS)."""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent / 'data'
OUT = DATA / 'ru-translator.json'
OX = DATA / 'oxford_3000.json'
SKIP_WORDS = {'a', 'an', 'the'}
MAX_VARIANTS = 3
SAVE_EVERY = 40
CYRILLIC = re.compile(r'[а-яё]', re.I)

POS_MAP = {
    'noun': 'noun',
    'verb': 'verb',
    'adjective': 'adjective',
    'adverb': 'adverb',
    'preposition': 'preposition',
    'conjunction': 'conjunction',
    'pronoun': 'pronoun',
    'determiner': 'determiner',
    'exclamation': 'interjection',
    'number': 'numeral',
    'ordinal number': 'adjective',
    'modal verb': 'verb',
    'auxiliary verb': 'verb',
}


def norm_pos(p):
    return (p or '').strip().lower()


def is_valid_ru(part):
    part = part.strip().lower()
    if not part or len(part) > 28:
        return False
    if not CYRILLIC.search(part):
        return False
    if re.search(r'\b[a-z]{3,}\b', part):
        return False
    return True


def google_dict(word):
    url = (
        'https://translate.googleapis.com/translate_a/single'
        f'?client=gtx&sl=en&tl=ru&dt=bd&dt=t&q={urllib.parse.quote(word)}'
    )
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        print(f'  err {word!r}: {exc}')
        return {}

    by_pos = {}
    blocks = data[1] if len(data) > 1 and isinstance(data[1], list) else []
    for block in blocks:
        if not isinstance(block, list) or len(block) < 3:
            continue
        pos_name = str(block[0]).lower()
        scored = []
        details = block[2] if len(block) > 2 and isinstance(block[2], list) else []
        for item in details:
            if not isinstance(item, list) or len(item) < 4:
                continue
            ru = str(item[0]).strip().lower()
            score = float(item[3] or 0)
            if is_valid_ru(ru):
                scored.append((score, ru))
        scored.sort(key=lambda x: (-x[0], len(x[1]), x[1]))
        seen = set()
        variants = []
        for _, ru in scored:
            if ru in seen:
                continue
            seen.add(ru)
            variants.append(ru)
            if len(variants) >= MAX_VARIANTS:
                break
        if variants:
            by_pos[pos_name] = variants

    if not by_pos and data[0]:
        primary = data[0][0][0].strip().lower()
        if is_valid_ru(primary):
            by_pos['_primary'] = [primary]

    return by_pos


def save(lexicon):
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(lexicon, f, ensure_ascii=False, indent=2)


def collect_lemmas():
    ox = json.load(open(OX, encoding='utf-8'))
    lemmas = set()
    for v in ox.values():
        if v.get('cefr') not in ('a1', 'a2'):
            continue
        word = (v.get('word') or '').strip().lower()
        if word and word not in SKIP_WORDS:
            lemmas.add(word)
    return sorted(lemmas, key=lambda w: (len(w), w))


def main():
    lemmas = collect_lemmas()
    lexicon = json.load(open(OUT, encoding='utf-8')) if OUT.exists() else {}
    total = len(lemmas)
    new_count = 0

    for i, word in enumerate(lemmas, 1):
        if word in lexicon and isinstance(lexicon[word], dict) and lexicon[word]:
            continue
        parsed = google_dict(word)
        if parsed:
            lexicon[word] = parsed
            new_count += 1
        if i % SAVE_EVERY == 0:
            save(lexicon)
            print(f'{i}/{total} · {len(lexicon)} lemmas · +{new_count} new')
        time.sleep(0.35)

    save(lexicon)
    print(f'Done: {len(lexicon)}/{total} lemmas → {OUT}')


if __name__ == '__main__':
    main()
