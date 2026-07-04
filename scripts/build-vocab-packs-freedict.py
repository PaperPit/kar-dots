#!/usr/bin/env python3
"""
Компактная сборка паков A0/A1/A2 (English → Russian) на словаре FreeDict eng-rus.

Зачем: вместо 2.9 ГБ Wiktionary берём маленький словарь FreeDict (~4 МБ), где переводы
структурированы по значениям (TEI XML). Это чинит шум старого пайплайна
(«add → долить», «above → высшее»), который возникал из-за обращения OpenRussian.

Уровни (какие слова в A1/A2) — из scripts/data/oxford_3000.json.
A0 — 450 самых коротких уникальных лемм из A1.
Ручные правки ru-overrides.json / ru-manual.json — поверх (высший приоритет).

СКАЧАТЬ СЛОВАРЬ (один раз, ~4 МБ):
  curl -L -o scripts/data/freedict-eng-rus.src.tar.xz \
    "https://download.freedict.org/dictionaries/eng-rus/2025.11.23/freedict-eng-rus-2025.11.23.src.tar.xz"
  (в архиве — TEI XML; распаковывать вручную НЕ нужно, скрипт читает .tar.xz сам)

  Запасной вариант — формат dictd (тоже поддерживается, ~5 МБ):
  curl -L -o scripts/data/freedict-eng-rus.dictd.tar.xz \
    "https://download.freedict.org/dictionaries/eng-rus/2025.11.23/freedict-eng-rus-2025.11.23.dictd.tar.xz"

ЗАПУСК:
  python3 scripts/build-vocab-packs-freedict.py
  python3 scripts/build-vocab-packs-freedict.py --selftest   # проверка без данных
  python3 scripts/build-vocab-packs-freedict.py --src путь/к/файлу.tar.xz

ЛИЦЕНЗИЯ: FreeDict eng-rus — GPL/свободная; укажите источник (freedict.org) в README/приложении.
"""
import argparse
import io
import json
import lzma
import re
import sys
import tarfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / 'data'
OUT = ROOT / 'packs'

VERSION = 9
MAX_VARIANTS = 3
MAX_A0_VARIANTS = 3

STRESS = '́'
LATIN_RE = re.compile(r'[a-z]', re.I)
PAREN_RE = re.compile(r'\([^)]*\)')
CYR_RE = re.compile(r'[а-яё]', re.I)
UKR = set('іїєґ')

# Oxford type → множество pos-кодов FreeDict/TEI, которые считаем совпадением.
POS_MATCH = {
    'noun': {'n', 'noun'},
    'verb': {'v', 'vi', 'vt', 'verb'},
    'modal verb': {'v', 'vi', 'vt', 'verb'},
    'auxiliary verb': {'v', 'vi', 'vt', 'verb'},
    'adjective': {'adj', 'adjective'},
    'ordinal number': {'adj', 'num', 'ord'},
    'adverb': {'adv', 'adverb'},
    'preposition': {'prep', 'preposition'},
    'conjunction': {'conj', 'conjunction'},
    'pronoun': {'pron', 'pronoun'},
    'determiner': {'det', 'art', 'article'},
    'exclamation': {'int', 'intj', 'interj', 'interjection'},
    'number': {'num', 'number'},
    'indefinite article': {'art', 'det'},
    'definite article': {'art', 'det'},
}

POS_SHORT = {
    'noun': 'сущ.', 'verb': 'гл.', 'adjective': 'прил.', 'adverb': 'нар.',
    'preposition': 'предл.', 'conjunction': 'союз', 'pronoun': 'мест.',
    'determiner': 'опр.', 'modal verb': 'мод.', 'auxiliary verb': 'всп.',
    'ordinal number': 'пор.', 'exclamation': 'межд.', 'number': 'числ.',
}

SKIP_POS = {'indefinite article', 'definite article'}

CANONICAL = {
    'be': ['быть'], 'and': ['и', 'а'], 'i': ['я'], 'a': [], 'an': [], 'the': [],
    'to': ['к', 'в', 'на'], 'of': ['из', 'от', 'о'], 'in': ['в', 'на'],
    'on': ['на', 'о'], 'at': ['в', 'у', 'на'], 'for': ['для', 'за'],
    'with': ['с', 'вместе с'], 'from': ['из', 'от', 'с'], 'by': ['у', 'к', 'от'],
    'as': ['как', 'в качестве'], 'or': ['или'], 'but': ['но', 'а'], 'if': ['если'],
    'when': ['когда'], 'where': ['где', 'куда'], 'why': ['почему', 'зачем'],
    'how': ['как'], 'what': ['что', 'какой'], 'who': ['кто'],
    'which': ['который', 'какой'], 'this': ['этот', 'это'], 'that': ['тот', 'то'],
    'these': ['эти'], 'those': ['те'], 'my': ['мой'], 'your': ['твой', 'ваш'],
    'his': ['его'], 'her': ['её'], 'its': ['его', 'её'], 'our': ['наш'],
    'their': ['их'], 'some': ['несколько', 'немного'], 'any': ['любой', 'какой-нибудь'],
    'many': ['много'], 'much': ['много'], 'more': ['больше', 'ещё'],
    'most': ['большинство', 'самый'], 'all': ['всё', 'все'], 'both': ['оба'],
    'each': ['каждый'], 'every': ['каждый', 'всякий'], 'other': ['другой'],
    'another': ['другой', 'ещё один'], 'same': ['тот же', 'одинаковый'],
    'such': ['такой'], 'no': ['нет', 'никакой'], 'not': ['не'], 'yes': ['да'],
    'do': ['делать'], 'have': ['иметь'], 'can': ['мочь'], 'could': ['мог бы'],
    'will': ['будет'], 'would': ['бы'], 'should': ['следует', 'должен'],
    'must': ['должен', 'обязан'], 'may': ['мочь', 'можно'], 'might': ['может быть'],
    'shall': ['буду'],
}


def norm_ru(raw):
    s = (raw or '').replace(STRESS, '').strip()
    # вики-разметка FreeDict: [[слово|показ]] -> показ, [[слово]] -> слово
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]+)\]\]', r'\1', s)
    s = PAREN_RE.sub('', s).strip().strip('.,;:!?').strip()
    s = re.sub(r'\s+', ' ', s)
    low = s.lower()
    if not low or len(low) > 28:
        return ''
    if '[' in low or ']' in low or '|' in low:   # остаточная разметка — брак
        return ''
    if LATIN_RE.search(low):
        return ''
    if not CYR_RE.search(low):
        return ''
    if any(c in UKR for c in low):
        return ''
    return low


def norm_pos(p):
    return (p or '').strip().lower()


def short_pos(p):
    p = norm_pos(p)
    return POS_SHORT.get(p, p.split()[0] if p else '')


def localname(tag):
    return tag.rsplit('}', 1)[-1]


# ------------------------------------------------------------------ FreeDict TEI

def read_member(tar_path, suffixes):
    """Возвращает (имя, bytes) первого файла в .tar.xz с нужным расширением."""
    with open(tar_path, 'rb') as fh:
        xz = lzma.open(fh)
        with tarfile.open(fileobj=io.BytesIO(xz.read())) as tf:
            for m in tf.getmembers():
                if m.isfile() and any(m.name.endswith(s) for s in suffixes):
                    return m.name, tf.extractfile(m).read()
    return None, None


def parse_tei(tei_bytes, needed_words):
    """index[(word, pos)] = [ru,...] по порядку значений."""
    index = defaultdict(list)
    root = ET.fromstring(tei_bytes)
    for entry in root.iter():
        if localname(entry.tag) != 'entry':
            continue
        word = None
        pos = ''
        by_order = []
        seen = set()
        for node in entry.iter():
            ln = localname(node.tag)
            if ln == 'orth' and word is None:
                word = (node.text or '').strip().lower()
            elif ln in ('pos', 'gram') and not pos:
                pos = norm_pos(node.text)
            elif ln == 'cit' and node.get('type') == 'trans':
                for q in node.iter():
                    if localname(q.tag) == 'quote':
                        ru = norm_ru(q.text or '')
                        if ru and ru not in seen:
                            seen.add(ru)
                            by_order.append(ru)
        if word and word in needed_words and by_order:
            index[(word, pos)].extend(x for x in by_order if x not in index[(word, pos)])
    return index


# ------------------------------------------------------------------ FreeDict dictd (запасной формат)

_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'


def b64int(s):
    n = 0
    for ch in s:
        n = n * 64 + _B64.index(ch)
    return n


def parse_dictd(tar_path, needed_words):
    import gzip
    idx_name, idx_bytes = read_member(tar_path, ('.index',))
    dz_name, dz_bytes = read_member(tar_path, ('.dict.dz', '.dict'))
    if not idx_bytes or not dz_bytes:
        return {}
    text = gzip.decompress(dz_bytes) if dz_name.endswith('.dz') else dz_bytes
    text = text.decode('utf-8', 'replace')
    index = defaultdict(list)
    for line in idx_bytes.decode('utf-8', 'replace').splitlines():
        parts = line.split('\t')
        if len(parts) < 3:
            continue
        hw = parts[0].strip().lower()
        if hw not in needed_words:
            continue
        off, length = b64int(parts[1]), b64int(parts[2])
        body = text[off:off + length]
        rus, seen = [], set()
        for chunk in re.split(r'[;,\n]', body):
            ru = norm_ru(chunk)
            if ru and ru not in seen:
                seen.add(ru)
                rus.append(ru)
        if rus:
            index[(hw, '')].extend(x for x in rus if x not in index[(hw, '')])
    return index


# ------------------------------------------------------------------ выбор перевода

def pick_from_index(word, pos, index):
    w = word.lower()
    want = POS_MATCH.get(norm_pos(pos), set())
    for (iw, ipos), rus in index.items():
        if iw == w and ipos in want:
            return rus[:MAX_VARIANTS]
    merged, seen = [], set()
    for (iw, ipos), rus in index.items():
        if iw != w:
            continue
        for ru in rus:
            if ru not in seen:
                seen.add(ru)
                merged.append(ru)
    return merged[:MAX_VARIANTS]


def override_key(word, pos):
    return f'{word.lower()}::{norm_pos(pos)}'


def dedupe(seq):
    seen, out = set(), []
    for v in seq:
        k = (v or '').lower().strip()
        if k and k not in seen:
            seen.add(k)
            out.append(v)
    return out


def pick_translations(word, pos, index, overrides):
    key = override_key(word, pos)
    if key in overrides:
        return dedupe(overrides[key])[:MAX_VARIANTS]
    variants = pick_from_index(word, pos, index)
    if not variants:
        variants = CANONICAL.get(word.lower(), [])
    return dedupe(variants)[:MAX_VARIANTS]


# ------------------------------------------------------------------ oxford / cards (как в основном скрипте)

def oxford_entries(raw, levels):
    items, seen = [], set()
    for v in raw.values():
        word = (v.get('word') or '').strip().lower()
        cefr = (v.get('cefr') or '').lower()
        pos = (v.get('type') or '').strip()
        if not word or cefr not in levels or norm_pos(pos) in SKIP_POS:
            continue
        k = (word, norm_pos(pos))
        if k in seen:
            continue
        seen.add(k)
        items.append({'word': word, 'cefr': cefr, 'pos': pos})
    return items


def a0_groups(all_a1, limit=450):
    by_word = defaultdict(list)
    for w in all_a1:
        by_word[w['word']].append(w)
    lemmas = sorted(by_word.keys(), key=lambda x: (len(x), x))[:limit]
    return [by_word[l] for l in lemmas]


def collapse_identical(cards):
    by_key, order = {}, []
    for c in cards:
        key = (c['front'], c['back'])
        if key not in by_key:
            by_key[key] = c
            order.append(key)
            continue
        ex = by_key[key]
        for part in c['description'].split(' · ', 1)[-1].split(', '):
            if part and part not in ex['description']:
                ex['description'] += (', ' if ' · ' in ex['description'] else ' · ') + part
    return [by_key[k] for k in order]


def make_cards(words, index, overrides):
    cards, seen = [], set()
    for w in words:
        variants = pick_translations(w['word'], w['pos'], index, overrides)
        back = ' / '.join(variants) if variants else w['word']
        desc = w['cefr'].upper() + (f' · {w["pos"]}' if w['pos'] else '')
        k = (w['word'], w['pos'], back)
        if k in seen:
            continue
        seen.add(k)
        cards.append({'front': w['word'], 'back': back, 'description': desc})
    return collapse_identical(cards)


def make_a0_cards(groups, index, overrides):
    cards = []
    for entries in groups:
        word = entries[0]['word']
        cefr = entries[0]['cefr']
        used_pos, all_variants = [], []
        for e in entries:
            variants = pick_translations(e['word'], e['pos'], index, overrides)
            if variants:
                used_pos.append(e['pos'])
                all_variants.extend(variants)
        back = ' / '.join(dedupe(all_variants)[:MAX_A0_VARIANTS]) if all_variants else word
        if used_pos:
            labels = ', '.join(dict.fromkeys(short_pos(p) for p in used_pos if p))
            desc = f'{cefr.upper()} · {labels}' if labels else cefr.upper()
        else:
            desc = cefr.upper()
        cards.append({'front': word, 'back': back, 'description': desc})
    return cards


def load_json(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def load_overrides():
    merged = {}
    for name in ('ru-overrides.json', 'ru-manual.json'):
        p = DATA / name
        if p.exists():
            merged.update(load_json(p))
    return merged


def find_dict(explicit):
    if explicit:
        return Path(explicit)
    for pat in ('*eng-rus*.src.tar.xz', '*eng-rus*.dictd.tar.xz',
                'freedict-eng-rus*.tar.xz', '*eng-rus*.tar.xz'):
        hits = sorted(DATA.glob(pat))
        if hits:
            return hits[-1]
    return None


def build_index(path, needed):
    name = str(path)
    if 'dictd' in name:
        print('Формат: dictd', file=sys.stderr)
        return parse_dictd(path, needed)
    # по умолчанию пробуем TEI из src-архива
    tei_name, tei_bytes = read_member(path, ('.tei', '.xml'))
    if tei_bytes:
        print(f'Формат: TEI XML ({tei_name})', file=sys.stderr)
        return parse_tei(tei_bytes, needed)
    print('TEI не найден — пробую dictd', file=sys.stderr)
    return parse_dictd(path, needed)


def build(path):
    ox = load_json(DATA / 'oxford_3000.json')
    overrides = load_overrides()
    all_a1 = oxford_entries(ox, {'a1'})
    all_a2 = oxford_entries(ox, {'a2'})
    needed = {e['word'] for e in all_a1} | {e['word'] for e in all_a2}
    print(f'Нужно слов: {len(needed)}. Читаю словарь: {path}', file=sys.stderr)
    index = build_index(path, needed)
    print(f'Найдено пар слово+ЧР: {len(index)}', file=sys.stderr)

    packs = [
        dict(id='en-a0-starters', title='English · A0',
             subtitle='Pre-A1 · базовая лексика (~450 слов)', level='A0',
             color='#6B9E78', a0=True, groups=a0_groups(all_a1)),
        dict(id='en-a1-oxford', title='English · A1',
             subtitle='Oxford 3000 · элементарный уровень', level='A1',
             color='#4A7FC1', words=all_a1),
        dict(id='en-a2-oxford', title='English · A2',
             subtitle='Oxford 3000 · ниже среднего', level='A2',
             color='#C45528', words=all_a2),
    ]
    OUT.mkdir(exist_ok=True)
    manifest = []
    for p in packs:
        cards = (make_a0_cards(p['groups'], index, overrides) if p.get('a0')
                 else make_cards(p['words'], index, overrides))
        multi = sum(1 for c in cards if ' / ' in c['back'])
        untr = sum(1 for c in cards if c['back'] == c['front'])
        doc = {'id': p['id'], 'title': p['title'], 'subtitle': p['subtitle'],
               'level': p['level'], 'lang': 'en', 'targetLang': 'ru',
               'version': VERSION, 'color': p['color'],
               'cardCount': len(cards), 'cards': cards}
        with open(OUT / f"{p['id']}.json", 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        manifest.append({'id': p['id'], 'title': p['title'], 'subtitle': p['subtitle'],
                         'level': p['level'], 'version': VERSION, 'color': p['color'],
                         'cardCount': len(cards), 'file': f"{p['id']}.json",
                         'multiVariantCards': multi, 'untranslatedCards': untr})
        print(f"{p['id']}: {len(cards)} карт, {multi} с вариантами, {untr} без перевода")
    with open(OUT / 'manifest.json', 'w', encoding='utf-8') as f:
        json.dump({'version': VERSION, 'packs': manifest}, f, ensure_ascii=False, indent=2)
    print('Готово →', OUT)


def selftest():
    tei = (
        '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>'
        '<entry><form><orth>add</orth></form><gramGrp><pos>v</pos></gramGrp>'
        '<sense><cit type="trans" xml:lang="rus"><quote>доба́влять</quote></cit>'
        '<cit type="trans" xml:lang="rus"><quote>прибавля́ть</quote></cit></sense></entry>'
        '<entry><form><orth>above</orth></form><gramGrp><pos>prep</pos></gramGrp>'
        '<sense><cit type="trans" xml:lang="rus"><quote>над</quote></cit>'
        '<cit type="trans" xml:lang="rus"><quote>выше</quote></cit></sense></entry>'
        '<entry><form><orth>adult</orth></form><gramGrp><pos>n</pos></gramGrp>'
        '<sense><cit type="trans" xml:lang="rus"><quote>взрослый</quote></cit></sense></entry>'
        '<entry><form><orth>book</orth></form><gramGrp><pos>n</pos></gramGrp>'
        '<sense><cit type="trans" xml:lang="rus"><quote>книга (bad paren)</quote></cit></sense></entry>'
        '</body></text></TEI>'
    ).encode('utf-8')
    idx = parse_tei(tei, {'add', 'above', 'adult', 'book'})
    checks = {('add', 'v'): 'добавлять', ('above', 'prep'): 'над',
              ('adult', 'n'): 'взрослый', ('book', 'n'): 'книга'}
    ok = True
    for (w, pos), expect in checks.items():
        got = pick_from_index(w, pos, idx)
        st = 'OK' if got and got[0] == expect else 'FAIL'
        ok = ok and st == 'OK'
        print(f'  [{st}] {w} ({pos}) → {got}  (ждали «{expect}»)')
    print('SELF-TEST:', 'PASSED' if ok else 'FAILED')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', help='путь к .tar.xz словаря FreeDict eng-rus')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()
    if args.selftest:
        sys.exit(selftest())
    path = find_dict(args.src)
    if not path or not path.exists():
        print('❌ Не найден словарь FreeDict.\n'
              '   Скачайте (~4 МБ):\n'
              '   curl -L -o scripts/data/freedict-eng-rus.src.tar.xz \\\n'
              '     "https://download.freedict.org/dictionaries/eng-rus/2025.11.23/'
              'freedict-eng-rus-2025.11.23.src.tar.xz"\n'
              '   и запустите снова.', file=sys.stderr)
        sys.exit(2)
    build(path)


if __name__ == '__main__':
    main()
