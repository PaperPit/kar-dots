import { el } from '../../../ui/ui.js';
import { route } from '../../../core/router.js';
import { DEFAULT_SETTINGS } from '../../../data/store-common.js';
import { segControl } from '../shared.js';
import {
  getSpeechVoices,
  waitForSpeechVoices,
  listSpeechVoicesForLang,
  formatSpeechVoiceLabel,
  speechSynthesisSupported,
} from '../../../lib/web-speech-tts.js';
import { previewSpeechVoice } from '../../../ui/tts.js';

const ALGO_DESCRIPTIONS = {
  sm2: 'Классика из Anki. Две кнопки: «Знаю» и «Не знаю». Интервал считается для каждой карточки отдельно — «Не знаю» вернёт её через 10 минут, «Знаю» отодвинет на день и дальше. Простой и привычный режим.',
  fsrs: 'Современный алгоритм (как в Anki 23.10+). Четыре оценки: Снова, Трудно, Хорошо, Легко — чем увереннее ответ, тем дольше пауза до следующего показа. Обычно точнее подбирает интервалы, чем SM-2.',
  leitner: 'Пять «коробок». Две кнопки: «Помню» — карточка поднимается в следующую коробку, «Не помню» — возвращается в первую. Через сколько дней показывать карточку из каждой коробки — настраивается ниже. Самый простой для понимания.',
};

const ALGO_FOOTNOTE = 'При переключении алгоритма старый прогресс не теряется — у SM-2, FSRS и Лейтнера он хранится отдельно.';

function fillVoiceSelect(select, voices, prefix, savedUri) {
  select.replaceChildren();
  select.append(el('option', { value: '' }, 'Авто (лучший доступный)'));
  listSpeechVoicesForLang(voices, prefix).forEach(v => {
    const opt = el('option', null, formatSpeechVoiceLabel(v));
    opt.value = v.voiceURI;
    select.append(opt);
  });
  const uri = String(savedUri || '').trim();
  select.value = uri && [...select.options].some(o => o.value === uri) ? uri : '';
}

function buildSpeechVoiceRow(s, save, ttsEnabled) {
  const ruSelect = el('select', { class: 'input speech-voice-select', disabled: !ttsEnabled });
  const enSelect = el('select', { class: 'input speech-voice-select', disabled: !ttsEnabled });
  const ruPreview = el('button', {
    type: 'button',
    class: 'btn ghost speech-preview-btn',
    title: 'Прослушать «Привет»',
    onclick: () => previewSpeechVoice('ru-RU'),
  }, '▶ Привет');
  const enPreview = el('button', {
    type: 'button',
    class: 'btn ghost speech-preview-btn',
    title: 'Прослушать «Hello»',
    onclick: () => previewSpeechVoice('en-US'),
  }, '▶ Hello');
  const hintEl = el('div', { class: 'speech-voice-hint muted' }, '');

  function refreshHint() {
    if (!speechSynthesisSupported()) {
      hintEl.textContent = 'Speech Synthesis недоступен в этом браузере.';
      return;
    }
    const n = getSpeechVoices().length;
    hintEl.textContent = n
      ? `Системных голосов: ${n}. «Авто» выбирает лучший для языка текста.`
      : 'Голоса загружаются… обновите страницу, если список пуст.';
  }

  function repopulate() {
    const voices = getSpeechVoices();
    fillVoiceSelect(ruSelect, voices, 'ru', s.ttsVoiceRu);
    fillVoiceSelect(enSelect, voices, 'en', s.ttsVoiceEn);
    refreshHint();
  }

  async function ensureVoices() {
    await waitForSpeechVoices();
    repopulate();
  }

  void ensureVoices();
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.addEventListener('voiceschanged', repopulate);
  }

  let ttsOn = ttsEnabled;

  function syncUi() {
    const on = ttsOn;
    ruSelect.disabled = !on;
    enSelect.disabled = !on;
    ruPreview.disabled = !on;
    enPreview.disabled = !on;
    refreshHint();
  }

  ruSelect.addEventListener('change', () => {
    s.ttsVoiceRu = ruSelect.value;
    save();
    if (ttsOn) void previewSpeechVoice('ru-RU');
  });

  enSelect.addEventListener('change', () => {
    s.ttsVoiceEn = enSelect.value;
    save();
    if (ttsOn) void previewSpeechVoice('en-US');
  });

  syncUi();

  const node = el('div', { class: 'setting-row setting-row-stack speech-voice-settings' }, [
    el('div', { class: 'lab' }, [
      el('b', null, 'Голоса браузера'),
      el('span', null, 'Speech Synthesis API — без интернета и лимитов. Язык текста определяется автоматически: кириллица → русский, латиница → английский.'),
      hintEl,
    ]),
    el('div', { class: 'speech-voice-row' }, [
      el('label', { class: 'speech-voice-label' }, 'Русский'),
      ruSelect,
      ruPreview,
    ]),
    el('div', { class: 'speech-voice-row' }, [
      el('label', { class: 'speech-voice-label' }, 'Английский'),
      enSelect,
      enPreview,
    ]),
  ]);

  return {
    node,
    setTtsEnabled(on) {
      ttsOn = on;
      syncUi();
    },
  };
}

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

  const speechVoiceBlock = buildSpeechVoiceRow(s, save, ttsEnabled);

  const ttsInput = el('input', { type: 'checkbox', class: 'chk' });
  ttsInput.checked = ttsEnabled;
  ttsInput.addEventListener('change', () => {
    s.tts = ttsInput.checked;
    ttsAutoInput.disabled = !ttsInput.checked;
    if (!ttsInput.checked) {
      s.ttsAuto = false;
      ttsAutoInput.checked = false;
    }
    speechVoiceBlock.setTtsEnabled(ttsInput.checked);
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
        el('span', null, 'На экране повторения появляется кнопка 🔊. Язык — по тексту (кириллица / латиница). Голоса и скорость настраиваются ниже.'),
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
    speechVoiceBlock.node,
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
