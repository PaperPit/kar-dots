#!/usr/bin/env python3
"""
Сборка лексических паков A0/A1/A2 (English → Russian) на основе Wiktionary.

Почему: старый build-vocab-packs.py строил переводы, ОБРАЩАЯ русский словарь
OpenRussian (RU→EN) в EN→RU. Это давало шум («add → долить», «above → высшее»),
потому что выбиралось любое русское слово, в чьём английском глоссе встретилось
искомое слово. Здесь источник переводов — английский Викисловарь (Wiktextract),
где русские переводы уже сгруппированы ПО ЗНАЧЕНИЯМ конкретного английского слова.

Уровни (какие слова входят в A1/A2) берём из вашего scripts/data/oxford_3000.json,
A0 — 450 самых коротких уникальных лемм из A1 (как в старом скрипте).
Ручные исправления ru-overrides.json / ru-manual.json применяются поверх (высший приоритет).

ДАННЫЕ WIKTIONARY (один раз скачать, ~2.6 ГБ .gz, качать на машине с интернетом):
  Страница: https://kaikki.org/dictionary/English/
  Файл английского словаря в JSONL. Скрипт ищет его по путям (можно .gz):
      scripts/data/wiktionary-en.jsonl.gz
      scripts/data/wiktionary-en.jsonl
  Либо укажите свой путь:  --wik /path/to/file.jsonl.gz
  Скачать (пример):
      curl -L -o scripts/data/wiktionary-en.jsonl.gz \
        "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz"
  (Если прямой ссылки нет — скачайте JSONL со страницы выше и при желании сожмите gzip.)

ЗАПУСК:
  python3 scripts/build-vocab-packs-wiktionary.py            # обычная сборка
  python3 scripts/build-vocab-packs-wiktionary.py --selftest # проверка логики без данных

ЛИЦЕНЗИЯ ДАННЫХ: переводы из Wiktionary — CC BY-SA. Укажите источник в README/приложении.
"""
import argparse
import gzip
import io
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / 'data'
OUT = ROOT / 'packs'

VERSION = 9
MAX_VARIANTS = 3
MAX_A0_VARIANTS = 3

STRESS = '́'                     # знак ударения — убираем
LATIN_RE = re.compile(r'[a-z]', re.I)
PAREN_RE = re.compile(r'\([^)]*\)')   # пояснения в скобках
UKR = set('іїєґ')

# Части речи Oxford → множество pos в Wiktextract, которые считаем совпадением.
POS_MATCH = {
    'noun': {'noun', 'proper noun'},
    'verb': {'verb'},
    'modal verb': {'verb'},
    'auxiliary verb': {'verb'},
    'adjective': {'adj', 'adjective'},
    'ordinal number': {'adj', 'num', 'numeral'},
    'adverb': {'adv', 'adverb'},
    'preposition': {'prep', 'preposition'},
    'conjunction': {'conj', 'conjunction'},
    'pronoun': {'pron', 'pronoun'},
    'determiner': {'det', 'determiner', 'article'},
    'exclamation': {'intj', 'interjection'},
    'number': {'num', 'numeral'},
    'indefinite article': {'article', 'det'},
    'definite article': {'article', 'det'},
}

POS_SHORT = {
    'noun': 'сущ.', 'verb': 'гл.', 'adjective': 'прил.', 'adverb': 'нар.',
    'preposition': 'предл.', 'conjunction': 'союз', 'pronoun': 'мест.',
    'determiner': 'опр.', 'modal verb': 'мод.', 'auxiliary verb': 'всп.',
    'ordinal number': 'пор.', 'exclamation': 'межд.', 'number': 'числ.',
}

SKIP_POS = {'indefinite article', 'definite article'}  # артиклям нет прямого перевода

# Служебные слова, которых в Wiktionary мало/нет переводов — задаём вручную,
# чтобы предлоги/местоимения/модальные не остались без ответа.
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
    """Чистим русский перевод: ударения, скобки, мусор."""
    s = (raw or '').replace(STRESS, '').strip()
    s = PAREN_RE.sub('', s).strip().strip('.,;:!?').strip()
    s = re.sub(r'\s+', ' ', s)
    low = s.lower()
    if not low or len(low) > 28:
        return ''
    if LATIN_RE.search(low):          # осталась латиница — это транслитерация/помета
        return ''
    if any(c in UKR for c in low):    # украинские буквы
        return ''
    return low


def norm_pos(p):
    return (p or '').strip().lower()


def short_pos(p):
    p = norm_pos(p)
    return POS_SHORT.get(p, p.split()[0] if p else '')


# ------------------------------------------------------------------ Wiktionary

def open_maybe_gz(path):
    if str(path).endswith('.gz'):
        return io.TextIOWrapper(gzip.open(path, 'rb'), encoding='utf-8')
    return open(path, encoding='utf-8')


def extract_ru_by_sense(entry):
    """
    Возвращает список русских переводов в порядке значений (первое значение — главное).
    Собирает и из entry['translations'], и из senses[*]['translations'].
    """
    by_sense = []          # список (sense_key, [ru, ...]) в порядке появления
    order = {}

    def add(sense_key, ru):
        if sense_key not in order:
            order[sense_key] = len(by_sense)
            by_sense.append((sense_key, []))
        by_sense[order[sense_key]][1].append(ru)

    def is_ru(t):
        return t.get('code') == 'ru' or t.get('lang') == 'Russian' or t.get('lang_code') == 'ru'

    for t in entry.get('translations', []) or []:
        if not is_ru(t):
            continue
        ru = norm_ru(t.get('word') or t.get('roman') or '')
        if ru:
            add(t.get('sense') or t.get('sense_id') or '_', ru)

    for si, sense in enumerate(entry.get('senses', []) or []):
        for t in sense.get('translations', []) or []:
            if not is_ru(t):
                continue
            ru = norm_ru(t.get('word') or '')
            if ru:
                add(f'_sense{si}', ru)

    return by_sense


def build_wik_index(path, needed_words):
    """
    index[(word, pos)] = [ru, ...] — переводы главного значения (затем следующих),
    уже очищенные и упорядоченные. Стримим построчно, держим в памяти только нужные слова.
    """
    index = defaultdict(list)
    seen_pair = set()
    n = 0
    with open_maybe_gz(path) as f:
        for line in f:
            n += 1
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if e.get('lang_code') not in (None, 'en') and e.get('lang') != 'English':
                continue
            w = (e.get('word') or '').strip().lower()
            if not w or w not in needed_words:
                continue
            pos = (e.get('pos') or '').strip().lower()
            pair = (w, pos)
            by_sense = extract_ru_by_sense(e)
            if not by_sense:
                continue
            # Плоский список по порядку значений, дедуп.
            flat = []
            seen = set()
            for _, rus in by_sense:
                for ru in rus:
                    if ru not in seen:
                        seen.add(ru)
                        flat.append(ru)
            if flat and pair not in seen_pair:
                index[pair] = flat
                seen_pair.add(pair)
            elif flat:
                index[pair].extend(x for x in flat if x not in index[pair])
            if n % 2_000_000 == 0:
                print(f'  …прочитано строк: {n:,}', file=sys.stderr)
    print(f'  Викисловарь: обработано {n:,} строк, найдено пар слово+ЧР: {len(index):,}',
          file=sys.stderr)
    return index


def pick_from_wik(word, pos, index):
    """Точное совпадение по ЧР → любое совпадение по слову."""
    w = word.lower()
    want = POS_MATCH.get(norm_pos(pos), set())
    # 1) совпадение части речи
    best = []
    for (iw, ipos), rus in index.items():
        if iw != w:
            continue
        if ipos in want:
            best = rus
            break
    if not best:  # 2) любое значение слова
        merged = []
        seen = set()
        for (iw, ipos), rus in index.items():
            if iw != w:
                continue
            for ru in rus:
                if ru not in seen:
                    seen.add(ru)
                    merged.append(ru)
        best = merged
    return best[:MAX_VARIANTS]


# ------------------------------------------------------------------ overrides

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
    variants = pick_from_wik(word, pos, index)
    if not variants:
        variants = CANONICAL.get(word.lower(), [])
    return dedupe(variants)[:MAX_VARIANTS]


# ------------------------------------------------------------------ oxford levels

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


# ------------------------------------------------------------------ cards

def collapse_identical(cards):
    by_key, order = {}, []
    for c in cards:
        key = (c['front'], c['back'])
        if key not in by_key:
            by_key[key] = c
            order.append(key)
            continue
        ex = by_key[key]
        tail = c['description'].split(' · ', 1)[-1]
        for part in tail.split(', '):
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


def find_wik(explicit):
    if explicit:
        return Path(explicit)
    for cand in ('wiktionary-en.jsonl.gz', 'wiktionary-en.jsonl'):
        p = DATA / cand
        if p.exists():
            return p
    return None


def build(wik_path):
    ox = load_json(DATA / 'oxford_3000.json')
    overrides = load_overrides()
    all_a1 = oxford_entries(ox, {'a1'})
    all_a2 = oxford_entries(ox, {'a2'})
    needed = {e['word'] for e in all_a1} | {e['word'] for e in all_a2}
    print(f'Нужно слов: {len(needed)}. Индексируем Викисловарь: {wik_path}', file=sys.stderr)
    index = build_wik_index(wik_path, needed)

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


# ------------------------------------------------------------------ self-test

def selftest():
    """Проверяем логику парсинга/выбора на маленьком образце (без скачивания)."""
    sample = [
        {'word': 'add', 'pos': 'verb', 'lang_code': 'en',
         'translations': [
             {'code': 'ru', 'word': 'доба́влять', 'sense': 'to combine'},
             {'code': 'ru', 'word': 'прибавля́ть', 'sense': 'to combine'},
             {'code': 'ru', 'word': 'скла́дывать', 'sense': 'math'},
         ]},
        {'word': 'above', 'pos': 'preposition', 'lang_code': 'en',
         'translations': [{'code': 'ru', 'word': 'над', 'sense': 'higher than'},
                          {'code': 'ru', 'word': 'вы́ше', 'sense': 'higher than'}]},
        {'word': 'adult', 'pos': 'noun', 'lang_code': 'en',
         'senses': [{'translations': [{'code': 'ru', 'word': 'взро́слый'}]}]},
        {'word': 'book', 'pos': 'noun', 'lang_code': 'en',
         'translations': [{'code': 'ru', 'word': 'кни́га', 'sense': 'collection of pages'}]},
        {'word': 'привет', 'pos': 'noun', 'lang_code': 'ru',   # не английское — должно игнориться
         'translations': [{'code': 'en', 'word': 'hi'}]},
    ]
    tmp = Path('/tmp/_wik_sample.jsonl')
    tmp.write_text('\n'.join(json.dumps(x, ensure_ascii=False) for x in sample), encoding='utf-8')
    idx = build_wik_index(tmp, {'add', 'above', 'adult', 'book', 'привет'})
    checks = {
        ('add', 'verb'): 'добавлять',
        ('above', 'preposition'): 'над',
        ('adult', 'noun'): 'взрослый',
        ('book', 'noun'): 'книга',
    }
    ok = True
    for (w, pos), expect in checks.items():
        got = pick_from_wik(w, pos, idx)
        status = 'OK' if got and got[0] == expect else 'FAIL'
        if status == 'FAIL':
            ok = False
        print(f'  [{status}] {w} ({pos}) → {got}  (ждали «{expect}» первым)')
    assert ('привет', 'noun') not in idx, 'русское слово не должно попасть в индекс'
    print('стресс-знаки убраны, латиница отфильтрована, русские заголовки игнорируются')
    print('SELF-TEST:', 'PASSED' if ok else 'FAILED')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wik', help='путь к JSONL(.gz) Викисловаря (kaikki English)')
    ap.add_argument('--selftest', action='store_true', help='проверить логику без данных')
    args = ap.parse_args()

    if args.selftest:
        sys.exit(selftest())

    wik = find_wik(args.wik)
    if not wik or not wik.exists():
        print('❌ Не найден файл Викисловаря.\n'
              '   Скачайте английский JSONL со страницы https://kaikki.org/dictionary/English/\n'
              '   и положите как scripts/data/wiktionary-en.jsonl(.gz)\n'
              '   или укажите путь: --wik /path/to/file.jsonl.gz', file=sys.stderr)
        sys.exit(2)
    build(wik)


if __name__ == '__main__':
    main()
