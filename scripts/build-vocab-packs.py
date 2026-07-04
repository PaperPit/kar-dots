#!/usr/bin/env python3
"""Сборка встроенных лексических паков: Oxford 3000 + OpenRussian + POS-ранжирование."""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).resolve().parent / 'data'
OR = DATA / 'openrussian'
OUT = ROOT / 'packs'

VERB_END = ('ться', 'чься', 'ить', 'ать', 'еть', 'уть', 'ыть', 'ти', 'чь')
ADJ_END = ('ый', 'ий', 'ой', 'ая', 'ое', 'ые', 'ие', 'ее', 'ей')
MAX_VARIANTS = 3

UKR = set('іїєґ')
BLOCK = {
    'конъюнкция', 'артикль', 'местоимение', 'предлог', 'союз', 'наречие',
    'частица', 'междометие', 'прекрасно', 'превосходно', 'превосходный',
    'отлично', 'пожалуйста', 'граната', 'бuti', 'бути', 'додать', 'та',
    'коло', 'пн', 'як', 'кили', 'меру', 'убить', 'вечеринка', 'тома',
    'несчатье', 'несчастье', 'к-как', 'как-как', 'кое-когда', 'на-на',
    'колодка', 'калякать', 'обегать', 'обежать', 'обок', 'иск', 'косяк',
    'дантист', 'дантистка', 'малосодержательный', 'порожняком', 'ваксить',
    'наваксить', 'променять', 'графа', 'шибко', 'наречь', 'нарекать', 'кличка',
}

# Части речи, которые не дают отдельную карточку в A0 при наличии «основной»
A0_SKIP_POS = {
    'auxiliary verb': {'verb', 'modal verb'},
    'determiner': {'pronoun'},
}

POS_SHORT = {
    'noun': 'сущ.',
    'verb': 'гл.',
    'adjective': 'прил.',
    'adverb': 'нар.',
    'preposition': 'предл.',
    'conjunction': 'союз',
    'pronoun': 'мест.',
    'determiner': 'опр.',
    'modal verb': 'мод.',
    'auxiliary verb': 'всп.',
    'indefinite article': 'арт.',
    'definite article': 'арт.',
    'ordinal number': 'пор.',
    'exclamation': 'межд.',
    'number': 'числ.',
}

MAX_A0_VARIANTS = 3

# Артикли не включаем — в русском нет прямого перевода
SKIP_POS = {'indefinite article', 'definite article'}

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

# Приоритет «учебниковых» переводов при равном счёте OpenRussian
CANONICAL = {
    'be': ['быть'],
    'and': ['и', 'а'],
    'egg': ['яйцо'],
    'i': ['я'],
    'to': ['к', 'в', 'на'],
    'of': ['из', 'от', 'о'],
    'in': ['в', 'на'],
    'on': ['на', 'о'],
    'at': ['в', 'у', 'на'],
    'for': ['для', 'за'],
    'with': ['с', 'вместе с'],
    'from': ['из', 'от', 'с'],
    'by': ['к', 'у', 'от'],
    'as': ['как', 'в качестве'],
    'or': ['или'],
    'but': ['но', 'а'],
    'if': ['если'],
    'when': ['когда'],
    'where': ['где', 'куда'],
    'why': ['почему', 'зачем'],
    'how': ['как'],
    'what': ['что', 'какой'],
    'who': ['кто'],
    'which': ['который', 'какой'],
    'this': ['этот', 'это'],
    'that': ['тот', 'то', 'что'],
    'these': ['эти'],
    'those': ['те'],
    'my': ['мой', 'моя', 'моё'],
    'your': ['твой', 'ваш'],
    'his': ['его'],
    'her': ['её'],
    'its': ['его', 'её'],
    'our': ['наш'],
    'their': ['их'],
    'some': ['некоторый', 'немного'],
    'any': ['любой', 'какой-нибудь'],
    'many': ['много'],
    'much': ['много'],
    'more': ['больше', 'ещё'],
    'most': ['большинство', 'самый'],
    'all': ['все', 'всё'],
    'both': ['оба'],
    'each': ['каждый'],
    'every': ['каждый', 'всякий'],
    'other': ['другой', 'иной'],
    'another': ['другой', 'ещё один'],
    'same': ['тот же', 'одинаковый'],
    'such': ['такой'],
    'no': ['нет', 'никакой'],
    'not': ['не'],
    'yes': ['да'],
    'do': ['делать'],
    'have': ['иметь', 'у'],
    'can': ['мочь', 'можно'],
    'could': ['мог', 'мог бы'],
    'will': ['буду', 'будет'],
    'would': ['бы', 'хотел бы'],
    'should': ['следует', 'должен'],
    'must': ['должен', 'обязан'],
    'may': ['мочь', 'можно'],
    'might': ['мог бы', 'может быть'],
    'shall': ['буду'],
    'fire': ['огонь', 'пожар'],
    'fifth': ['пятый'],
}

# Минимальный POS-score, чтобы принять перевод из OpenRussian
MIN_POS_SCORE = 20


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def norm_pos(pos):
    return (pos or '').strip().lower()


def override_key(word, pos):
    return f'{word.lower()}::{norm_pos(pos)}'


def ru_pos_hint(ru):
    ru = ru.lower().strip()
    if ru.endswith(VERB_END):
        return 'verb'
    if any(ru.endswith(e) for e in ADJ_END):
        return 'adj'
    if ru.endswith('о') and len(ru) > 3:
        return 'adv'
    return 'noun'


def is_bad_ru(ru):
    ru_l = ru.lower().strip()
    if not ru_l or len(ru_l) > 24:
        return True
    if any(c in UKR for c in ru_l):
        return True
    if ru_l in BLOCK:
        return True
    if re.search(r'[a-z]', ru_l):
        return True
    if re.match(r'^[а-яё]{1,2}-', ru_l):
        return True
    if ru_l.startswith('как-') or ru_l.startswith('кое-'):
        return True
    return False


def parse_translation_field(text):
    """Разбор translations_en: ; — разные значения, , — синонимы (первые — частые)."""
    if not text:
        return []
    out = []
    for gloss_idx, chunk in enumerate(re.split(r';', text)):
        chunk = chunk.strip().lower()
        if not chunk:
            continue
        for syn_idx, gloss in enumerate(re.split(r',', chunk)):
            gloss = gloss.strip()
            if gloss:
                out.append((gloss_idx, syn_idx, gloss))
    return out


def glosses(text):
    if not text:
        return []
    return [g for _, _, g in parse_translation_field(text)]


def build_openrussian_index():
    """Индекс EN→RU; порядок строк CSV ≈ частотность русского слова."""
    idx = defaultdict(list)
    ru_freq_rank = {}
    row_rank = 0
    for name in ('nouns.csv', 'verbs.csv', 'others.csv'):
        path = OR / name
        if not path.exists():
            continue
        with open(path, encoding='utf-8') as f:
            for row in csv.DictReader(f, delimiter='\t'):
                row_rank += 1
                ru = row.get('bare', '').strip().lower()
                if is_bad_ru(ru):
                    continue
                if ru not in ru_freq_rank:
                    ru_freq_rank[ru] = row_rank
                for gloss_idx, syn_idx, g in parse_translation_field(
                    row.get('translations_en', '')
                ):
                    targets = {g, re.sub(r'^to ', '', g).strip()}
                    if g.startswith('to '):
                        rest = g[3:].strip()
                        if rest:
                            targets.add(rest)
                    for t in targets:
                        if not t:
                            continue
                        s = match_gloss(g, t)
                        if s:
                            idx[t].append((s, ru, g, gloss_idx, syn_idx))
    return idx, ru_freq_rank


def score_translation(ru, en_pos, word):
    ru_l = ru.lower().strip()
    if is_bad_ru(ru_l):
        return -100

    canon = CANONICAL.get(word.lower(), [])
    if ru_l in canon:
        return 1000 + (len(canon) - canon.index(ru_l))

    en_pos = norm_pos(en_pos)
    hint = ru_pos_hint(ru_l)
    score = 0

    if 'noun' in en_pos:
        if hint == 'noun':
            score += 45
        if hint == 'verb':
            score -= 55
        if hint == 'adj':
            score -= 10
    elif 'verb' in en_pos or 'modal' in en_pos:
        if hint == 'verb':
            score += 45
        if hint == 'noun':
            score -= 25
    elif 'adjective' in en_pos or 'ordinal' in en_pos:
        if hint == 'adj':
            score += 50
        if hint == 'verb':
            score -= 55
        if hint == 'noun':
            score -= 35
    elif 'adverb' in en_pos:
        if hint == 'adv' or ru_l.endswith('о'):
            score += 35
        if hint == 'verb':
            score -= 40
    elif 'preposition' in en_pos or 'conjunction' in en_pos:
        score += 10
    elif 'determiner' in en_pos or 'pronoun' in en_pos:
        score += 5
    elif 'article' in en_pos:
        score += 5

    score -= len(ru_l) * 0.2
    if '-' in ru_l:
        score -= 5
    return score


def match_gloss(gloss, word):
    gloss = gloss.lower().strip()
    word = word.lower()
    if gloss == word:
        return 100
    if gloss.startswith('to ' + word) and (
        len(gloss) == len(word) + 3 or gloss[len(word) + 3] in ' ('
    ):
        return 95
    if gloss.startswith(word + ' ') and len(gloss.split()) <= 4:
        return 90
    return 0


def rank_variant(ru, word, pos, meta, ru_freq_rank):
    """Чем меньше tuple — тем выше приоритет (POS, gloss, частотность)."""
    gloss_score, gloss_idx, syn_idx = meta
    pos_score = score_translation(ru, pos, word)
    freq = ru_freq_rank.get(ru, 999_999)
    return (
        -pos_score,
        -gloss_score,
        gloss_idx,
        syn_idx,
        freq,
        len(ru),
        ru,
    )


def pick_from_openrussian(word, pos, or_idx, ru_freq_rank):
    word = word.lower()
    cands = {}
    for s, ru, g, gloss_idx, syn_idx in or_idx.get(word, []):
        if is_bad_ru(ru):
            continue
        if s < 100 and len(word) <= 3:
            continue
        if s < 90:
            continue
        if s < 100 and ' ' in g and g != word:
            continue
        meta = (s, gloss_idx, syn_idx)
        prev = cands.get(ru)
        if prev is None or rank_variant(ru, word, pos, meta, ru_freq_rank) < rank_variant(
            ru, word, pos, prev, ru_freq_rank
        ):
            cands[ru] = meta

    if not cands:
        return []

    ranked = sorted(
        cands,
        key=lambda ru: rank_variant(ru, word, pos, cands[ru], ru_freq_rank),
    )
    return ranked[:MAX_VARIANTS]


def pick_from_eng_rus(word, pos, dct, ru_freq_rank):
    raw = dct.get(word.upper(), [])
    if not raw:
        return []

    seen = set()
    ordered = []
    for r in raw:
        rl = r.strip().lower()
        if not rl or is_bad_ru(rl) or rl in seen:
            continue
        seen.add(rl)
        ordered.append(rl)

    ranked = sorted(
        ordered,
        key=lambda ru: (
            -score_translation(ru, pos, word),
            ru_freq_rank.get(ru, 999_999),
            len(ru),
            ru,
        ),
    )
    return ranked[:MAX_VARIANTS]


def dedupe_variants(variants):
    seen = set()
    out = []
    for v in variants:
        key = v.lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


def pick_translations(word, pos, or_idx, dct, overrides, translator, ru_freq_rank):
    key = override_key(word, pos)
    if key in overrides:
        return dedupe_variants(overrides[key][:MAX_VARIANTS])

    if key in translator:
        return dedupe_variants(translator[key][:MAX_VARIANTS])

    lemma = word.lower()
    entry = translator.get(lemma)
    if entry:
        if isinstance(entry, list):
            return dedupe_variants(entry[:MAX_VARIANTS])
        if isinstance(entry, dict):
            pos_n = norm_pos(pos)
            gpos = POS_MAP.get(pos_n, pos_n)
            if gpos in entry:
                return dedupe_variants(entry[gpos][:MAX_VARIANTS])
            if pos_n in entry:
                return dedupe_variants(entry[pos_n][:MAX_VARIANTS])
            if '_primary' in entry:
                return dedupe_variants(entry['_primary'][:MAX_VARIANTS])
            for v in entry.values():
                if isinstance(v, list) and v:
                    return dedupe_variants(v[:MAX_VARIANTS])

    variants = pick_from_openrussian(word, pos, or_idx, ru_freq_rank)
    if variants:
        pos_scores = [score_translation(v, pos, word) for v in variants]
        if max(pos_scores) < MIN_POS_SCORE:
            fallback = pick_from_eng_rus(word, pos, dct, ru_freq_rank)
            variants = fallback if fallback else dedupe_variants(variants)
        else:
            variants = dedupe_variants(variants)
    else:
        variants = pick_from_eng_rus(word, pos, dct, ru_freq_rank)

    canon = CANONICAL.get(word.lower(), [])
    if canon:
        variants = dedupe_variants(canon + variants)
    return variants[:MAX_VARIANTS]


def sort_variants_by_frequency(word, pos, variants, ru_freq_rank):
    return sorted(
        dedupe_variants(variants),
        key=lambda ru: (
            -score_translation(ru, pos, word),
            ru_freq_rank.get(ru, 999_999),
            len(ru),
            ru,
        ),
    )[:MAX_VARIANTS]


def oxford_entries(raw, levels):
    items = []
    seen = set()
    for v in raw.values():
        word = (v.get('word') or '').strip().lower()
        cefr = (v.get('cefr') or '').lower()
        pos = (v.get('type') or '').strip()
        if not word or cefr not in levels:
            continue
        if norm_pos(pos) in SKIP_POS:
            continue
        key = (word, norm_pos(pos))
        if key in seen:
            continue
        seen.add(key)
        items.append({'word': word, 'cefr': cefr, 'pos': pos})
    return items


def should_skip_pos_for_a0(pos, all_pos):
    pos_n = norm_pos(pos)
    skip_for = A0_SKIP_POS.get(pos_n)
    if not skip_for:
        return False
    others = {norm_pos(p) for p in all_pos if norm_pos(p) != pos_n}
    return bool(others & skip_for)


def a0_unique_lemmas(all_a1, limit=450):
    """450 уникальных слов (без дублей по частям речи)."""
    by_word = defaultdict(list)
    for w in all_a1:
        by_word[w['word']].append(w)
    lemmas = sorted(by_word.keys(), key=lambda x: (len(x), x))[:limit]
    return [by_word[lemma] for lemma in lemmas]


def short_pos_label(pos):
    pos_n = norm_pos(pos)
    return POS_SHORT.get(pos_n, pos_n.split()[0] if pos_n else '')


def make_a0_cards(word_groups, or_idx, dct, overrides, translator, ru_freq_rank):
    """Одна карточка на слово — до 3 самых частых переводов."""
    cards = []
    for entries in word_groups:
        word = entries[0]['word']
        cefr = entries[0]['cefr']
        all_pos = [e['pos'] for e in entries]
        used_pos = []
        all_variants = []
        primary_pos = None

        for e in entries:
            if should_skip_pos_for_a0(e['pos'], all_pos):
                continue
            if primary_pos is None:
                primary_pos = e['pos']
            variants = pick_translations(
                e['word'], e['pos'], or_idx, dct, overrides, translator, ru_freq_rank
            )
            if variants:
                used_pos.append(e['pos'])
                all_variants.extend(variants)

        if not all_variants:
            back = word
        else:
            back = ' / '.join(dedupe_variants(all_variants)[:MAX_A0_VARIANTS])

        if used_pos:
            pos_labels = ', '.join(dict.fromkeys(short_pos_label(p) for p in used_pos if p))
            desc = f'{cefr.upper()} · {pos_labels}' if pos_labels else cefr.upper()
        else:
            desc = cefr.upper()

        cards.append({'front': word, 'back': back, 'description': desc})
    return cards


def collapse_identical_backs(cards):
    """Убрать карточки с одинаковыми front+back (разные POS)."""
    by_key = {}
    order = []
    for c in cards:
        key = (c['front'], c['back'])
        if key not in by_key:
            by_key[key] = c
            order.append(key)
            continue
        existing = by_key[key]
        for part in c['description'].split(' · ', 1)[-1].split(', '):
            if part and part not in existing['description']:
                if ' · ' in existing['description']:
                    existing['description'] += f', {part}'
                else:
                    existing['description'] += f' · {part}'
    return [by_key[k] for k in order]


def make_cards(words, or_idx, dct, overrides, translator, ru_freq_rank):
    cards = []
    seen = set()
    for w in words:
        variants = pick_translations(
            w['word'], w['pos'], or_idx, dct, overrides, translator, ru_freq_rank
        )
        if not variants:
            back = w['word']
        else:
            back = ' / '.join(variants)
        desc = w['cefr'].upper()
        if w['pos']:
            desc += f' · {w["pos"]}'
        card_key = (w['word'], w['pos'], back)
        if card_key in seen:
            continue
        seen.add(card_key)
        cards.append({
            'front': w['word'],
            'back': back,
            'description': desc,
        })
    return collapse_identical_backs(cards)


def merge_overrides(*maps):
    merged = {}
    for m in maps:
        merged.update(m)
    return merged


def main():
    ox = load_json(DATA / 'oxford_3000.json')
    tr = load_json(DATA / 'eng-rus.json')
    translator_path = DATA / 'ru-translator.json'
    translator = load_json(translator_path) if translator_path.exists() else {}
    overrides = merge_overrides(
        load_json(DATA / 'ru-overrides.json'),
        load_json(DATA / 'ru-manual.json'),
    )
    or_idx, ru_freq_rank = build_openrussian_index()

    all_a1 = oxford_entries(ox, {'a1'})
    all_a2 = oxford_entries(ox, {'a2'})

    a0_groups = a0_unique_lemmas(all_a1, limit=450)

    packs = [
        {
            'id': 'en-a0-starters',
            'title': 'English · A0',
            'subtitle': 'Pre-A1 · базовая лексика (~450 слов)',
            'level': 'A0',
            'version': 9,
            'color': '#6B9E78',
            'a0_merge': True,
            'word_groups': a0_groups,
        },
        {
            'id': 'en-a1-oxford',
            'title': 'English · A1',
            'subtitle': 'Oxford 3000 · элементарный уровень',
            'level': 'A1',
            'version': 9,
            'color': '#4A7FC1',
            'words': all_a1,
        },
        {
            'id': 'en-a2-oxford',
            'title': 'English · A2',
            'subtitle': 'Oxford 3000 · ниже среднего',
            'level': 'A2',
            'version': 9,
            'color': '#C45528',
            'words': all_a2,
        },
    ]

    OUT.mkdir(exist_ok=True)
    manifest = []

    for p in packs:
        if p.get('a0_merge'):
            cards = make_a0_cards(p['word_groups'], or_idx, tr, overrides, translator, ru_freq_rank)
        else:
            cards = make_cards(p['words'], or_idx, tr, overrides, translator, ru_freq_rank)
        multi = sum(1 for c in cards if ' / ' in c['back'])
        untranslated = sum(1 for c in cards if c['back'] == c['front'])
        doc = {
            'id': p['id'],
            'title': p['title'],
            'subtitle': p['subtitle'],
            'level': p['level'],
            'lang': 'en',
            'targetLang': 'ru',
            'version': p['version'],
            'color': p['color'],
            'cardCount': len(cards),
            'cards': cards,
        }
        out_path = OUT / f"{p['id']}.json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        manifest.append({
            'id': p['id'],
            'title': p['title'],
            'subtitle': p['subtitle'],
            'level': p['level'],
            'version': p['version'],
            'color': p['color'],
            'cardCount': len(cards),
            'file': f"{p['id']}.json",
            'multiVariantCards': multi,
            'untranslatedCards': untranslated,
        })
        print(
            f"{p['id']}: {len(cards)} cards, {multi} multi-variant, "
            f"{untranslated} untranslated"
        )

    with open(OUT / 'manifest.json', 'w', encoding='utf-8') as f:
        json.dump({'version': 9, 'packs': manifest}, f, ensure_ascii=False, indent=2)
    print('Done →', OUT)


if __name__ == '__main__':
    main()
