import { el } from '../../../ui/ui.js';
import { route } from '../../../core/router.js';
import { DEFAULT_SETTINGS } from '../../../data/store-common.js';
import { segControl } from '../shared.js';

const ALGO_DESCRIPTIONS = {
  sm2: 'Классика из Anki. Две кнопки: «Знаю» и «Не знаю». Интервал считается для каждой карточки отдельно — «Не знаю» вернёт её через 10 минут, «Знаю» отодвинет на день и дальше. Простой и привычный режим.',
  fsrs: 'Современный алгоритм (как в Anki 23.10+). Четыре оценки: Снова, Трудно, Хорошо, Легко — чем увереннее ответ, тем дольше пауза до следующего показа. Обычно точнее подбирает интервалы, чем SM-2.',
  leitner: 'Пять «коробок». Две кнопки: «Помню» — карточка поднимается в следующую коробку, «Не помню» — возвращается в первую. Через сколько дней показывать карточку из каждой коробки — настраивается ниже. Самый простой для понимания.',
};

const ALGO_FOOTNOTE = 'При переключении алгоритма старый прогресс не теряется — у SM-2, FSRS и Лейтнера он хранится отдельно.';

export function buildAlgoGroup(s, save) {
  let ttsAutoInput;
  const ttsEnabled = s.tts !== false;

  ttsAutoInput = el('input', { type: 'checkbox', class: 'chk' });
  ttsAutoInput.checked = ttsEnabled && !!s.ttsAuto;
  ttsAutoInput.disabled = !ttsEnabled;
  ttsAutoInput.addEventListener('change', () => {
    s.ttsAuto = ttsAutoInput.checked;
    save();
  });

  const ttsInput = el('input', { type: 'checkbox', class: 'chk' });
  ttsInput.checked = ttsEnabled;
  ttsInput.addEventListener('change', () => {
    s.tts = ttsInput.checked;
    ttsAutoInput.disabled = !ttsInput.checked;
    if (!ttsInput.checked) {
      s.ttsAuto = false;
      ttsAutoInput.checked = false;
    }
    save();
  });

  const algoDesc = el('span', { class: 'algo-desc' }, ALGO_DESCRIPTIONS[s.algo] || ALGO_DESCRIPTIONS.sm2);
  const algoFootnote = el('span', { class: 'algo-footnote muted' }, ALGO_FOOTNOTE);

  const algoGroup = el('div', { class: 'settings-group' }, [
    el('h4', null, 'Интервальное повторение'),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Алгоритм'),
        algoDesc,
        algoFootnote,
      ]),
      segControl(s.algo, [
        { v: 'sm2', label: 'SM-2' },
        { v: 'fsrs', label: 'FSRS' },
        { v: 'leitner', label: 'Лейтнер' },
      ], v => {
        s.algo = v;
        algoDesc.textContent = ALGO_DESCRIPTIONS[v] || ALGO_DESCRIPTIONS.sm2;
        save();
        route();
      }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Направление'),
        el('span', null, 'Какую сторону карточки показывать первой.'),
      ]),
      segControl(s.direction, [
        { v: 'ftb', label: 'Лицо' }, { v: 'btf', label: 'Оборот' }, { v: 'mixed', label: 'Вперемешку' },
      ], v => { s.direction = v; save(); }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Новых карточек в день'),
        el('span', null, 'Чтобы не перегружаться в начале.'),
      ]),
      (() => {
        const inp = el('input', { type: 'number', min: 1, max: 500, value: s.newPerDay });
        inp.addEventListener('change', () => { s.newPerDay = Math.max(1, Number(inp.value) || 20); save(); });
        return inp;
      })(),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Озвучка на повторении'),
        el('span', null, 'На экране повторения появляется кнопка 🔊. Нажмите — прочитает то, что сейчас на карточке: лицо или оборот (определение и описание). Язык выбирается по тексту: кириллица — русский, латиница — английский. Скорость — ползунком ниже.'),
      ]),
      el('label', { class: 'chk-wrap' }, ttsInput),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Озвучивать при перевороте'),
        el('span', null, ttsEnabled
          ? 'Без нажатия на 🔊: после каждого переворота карточки (тап, пробел или Enter) сразу читается видимая сторона. Не срабатывает при оценке «Знаю» / «Не знаю» и не читает карточку до первого переворота.'
          : 'Сначала включите «Озвучку на повторении» — тогда можно включить автоматическое чтение при перевороте.'),
      ]),
      el('label', { class: 'chk-wrap' }, ttsAutoInput),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Скорость озвучки'),
        el('span', null, 'От 0,5× (медленнее) до 2× (быстрее).'),
      ]),
      (() => {
        const rate = Math.min(2, Math.max(0.5, Number(s.ttsRate ?? 1) || 1));
        const val = el('span', { class: 'tts-rate-val tnum' }, rate.toFixed(1) + '×');
        const range = el('input', {
          type: 'range', class: 'tts-rate', min: 0.5, max: 2, step: 0.1, value: rate,
        });
        const sync = () => {
          const v = Math.min(2, Math.max(0.5, Number(range.value) || 1));
          s.ttsRate = Math.round(v * 10) / 10;
          val.textContent = s.ttsRate.toFixed(1) + '×';
          range.value = String(s.ttsRate);
        };
        range.addEventListener('input', sync);
        range.addEventListener('change', () => { sync(); save(); });
        return el('div', { class: 'tts-rate-wrap' }, [val, range]);
      })(),
    ]),
  ]);

  if (s.algo === 'leitner') {
    const row = el('div', { class: 'row leitner-intervals-row' });
    const intervals = s.leitnerIntervals || DEFAULT_SETTINGS.leitnerIntervals;
    intervals.forEach((d, i) => {
      const inp = el('input', { type: 'number', min: 1, max: 365, value: d, class: 'input leitner-interval-input' });
      inp.addEventListener('change', () => {
        s.leitnerIntervals[i] = Math.max(1, Number(inp.value) || 1);
        save();
      });
      row.append(el('div', { class: 'text-center' }, [
        el('div', { class: 'muted' }, 'Кор. ' + (i + 1)),
        inp,
      ]));
    });
    algoGroup.append(el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, 'Интервалы коробок (дни)'),
        el('span', null, 'Через сколько дней показывать карточку из каждой коробки.'),
      ]),
      row,
    ]));
  }

  return algoGroup;
}
