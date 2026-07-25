import { el, confirmDialog } from '../../../ui/ui.js';
import { route } from '../../../core/router.js';
import { DEFAULT_SETTINGS } from '../../../data/store-common.js';
import { t, tp } from '../../../lib/i18n.js';
import { segControl } from '../shared.js';
import type { SpeechVoiceLike } from '../../../lib/web-speech-tts.js';
import type { RetentionAdvice } from '../../../lib/fsrs-optimize.js';

interface SettingsLike {
  algo: string;
  direction?: string;
  newPerDay?: number;
  reviewsPerDay?: number;
  tts?: boolean;
  ttsAuto?: boolean;
  ttsRate?: number;
  ttsVoiceRu?: string;
  ttsVoiceEn?: string;
  fsrsRetention?: number;
  fsrsFuzz?: boolean;
  fsrsWeights?: number[] | null;
  leitnerIntervals: number[];
}
import {
  getSpeechVoices,
  waitForSpeechVoices,
  listSpeechVoicesForLang,
  formatSpeechVoiceLabel,
  speechSynthesisSupported,
} from '../../../lib/web-speech-tts.js';
import { previewSpeechVoice } from '../../../ui/tts.js';

function algoDescKey(algo: string): string {
  if (algo === 'fsrs' || algo === 'leitner') return `settings.algo.desc.${algo}`;
  return 'settings.algo.desc.sm2';
}

function formatRetentionAdvice(adv: RetentionAdvice, reviewRetention: number | null): string {
  if (adv.level === 'nodata') return t('settings.algo.fsrs.adviceNodata');
  const pct = reviewRetention != null ? Math.round(reviewRetention * 100) : 0;
  if (adv.level === 'high') return t('settings.algo.fsrs.adviceHigh', { pct });
  if (adv.level === 'low') return t('settings.algo.fsrs.adviceLow', { pct });
  return t('settings.algo.fsrs.adviceOk', { pct });
}

function fillVoiceSelect(
  select: HTMLSelectElement,
  voices: SpeechVoiceLike[],
  prefix: string,
  savedUri: string | undefined,
) {
  select.replaceChildren();
  select.append(el('option', { value: '' }, t('settings.algo.voiceAuto')));
  listSpeechVoicesForLang(voices, prefix).forEach(v => {
    const opt = el('option', null, formatSpeechVoiceLabel(v));
    opt.value = v.voiceURI;
    select.append(opt);
  });
  const uri = String(savedUri || '').trim();
  select.value = uri && [...select.options].some(o => o.value === uri) ? uri : '';
}

function buildSpeechVoiceRow(s: SettingsLike, save: () => void, ttsEnabled: boolean) {
  const ruSelect = el('select', { class: 'input speech-voice-select', disabled: !ttsEnabled }, []) as HTMLSelectElement;
  const enSelect = el('select', { class: 'input speech-voice-select', disabled: !ttsEnabled }, []) as HTMLSelectElement;
  const ruPreview = el('button', {
    type: 'button',
    class: 'btn ghost speech-preview-btn',
    title: t('settings.algo.previewRu'),
    onclick: () => previewSpeechVoice('ru-RU'),
  }, t('settings.algo.previewRuBtn')) as HTMLButtonElement;
  const enPreview = el('button', {
    type: 'button',
    class: 'btn ghost speech-preview-btn',
    title: t('settings.algo.previewEn'),
    onclick: () => previewSpeechVoice('en-US'),
  }, t('settings.algo.previewEnBtn')) as HTMLButtonElement;
  const hintEl = el('div', { class: 'speech-voice-hint muted' }, '');

  function refreshHint() {
    if (!speechSynthesisSupported()) {
      hintEl.textContent = t('settings.algo.speechUnavailable');
      return;
    }
    const n = getSpeechVoices().length;
    hintEl.textContent = n
      ? t('settings.algo.speechVoicesCount', { n })
      : t('settings.algo.speechVoicesLoading');
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
      el('b', null, t('settings.algo.speechVoicesTitle')),
      el('span', null, t('settings.algo.speechVoicesHint')),
      hintEl,
    ]),
    el('div', { class: 'speech-voice-row' }, [
      el('label', { class: 'speech-voice-label' }, t('settings.algo.voiceRu')),
      ruSelect,
      ruPreview,
    ]),
    el('div', { class: 'speech-voice-row' }, [
      el('label', { class: 'speech-voice-label' }, t('settings.algo.voiceEn')),
      enSelect,
      enPreview,
    ]),
  ]);

  return {
    node,
    setTtsEnabled(on: boolean) {
      ttsOn = on;
      syncUi();
    },
  };
}

export function buildAlgoGroup(s: SettingsLike, save: () => void) {
  let ttsAutoInput;
  const ttsEnabled = s.tts !== false;

  ttsAutoInput = el('input', { type: 'checkbox', class: 'chk' }, []) as HTMLInputElement;
  ttsAutoInput.checked = ttsEnabled && !!s.ttsAuto;
  ttsAutoInput.disabled = !ttsEnabled;
  ttsAutoInput.addEventListener('change', () => {
    s.ttsAuto = ttsAutoInput.checked;
    save();
  });

  const speechVoiceBlock = buildSpeechVoiceRow(s, save, ttsEnabled);

  const ttsInput = el('input', { type: 'checkbox', class: 'chk' }, []) as HTMLInputElement;
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

  const ttsAutoHint = el('span', null, '');
  const algoDesc = el('span', { class: 'algo-desc' }, t(algoDescKey(s.algo)));
  const algoFootnote = el('span', { class: 'algo-footnote muted' }, t('settings.algo.footnote'));

  const ALGO_VALUES = ['sm2', 'fsrs', 'leitner'];
  /**
   * Смена алгоритма — не косметика: новый алгоритм не видит расписания старого
   * и начнёт карточки заново. Спрашиваем подтверждение, а при отказе
   * возвращаем сегмент на прежнее значение (segControl подсвечивает кнопку
   * ещё до onChange).
   */
  async function changeAlgo(v: string) {
    const prev = s.algo;
    if (v === prev) return;
    const yes = await confirmDialog(
      t('settings.algo.confirmTitle'),
      t('settings.algo.confirmBody'),
      t('settings.algo.confirmOk'),
    );
    if (!yes) {
      const idx = ALGO_VALUES.indexOf(prev);
      algoSeg.querySelectorAll('button').forEach((b, i) => {
        const on = i === idx;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      return;
    }
    s.algo = v;
    algoDesc.textContent = t(algoDescKey(v));
    save();
    route();
  }

  const algoSeg = segControl(s.algo, [
    { v: 'sm2', label: 'SM-2' },
    { v: 'fsrs', label: 'FSRS' },
    { v: 'leitner', label: t('settings.algo.leitner') },
  ], v => { void changeAlgo(v); });

  const algoGroup = el('div', { class: 'settings-group' }, [
    el('h4', null, t('settings.algo.title')),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.algorithm')),
        algoDesc,
        algoFootnote,
      ]),
      algoSeg,
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.direction')),
        el('span', null, t('settings.algo.directionHint')),
      ]),
      segControl(s.direction, [
        { v: 'ftb', label: t('review.side.front') },
        { v: 'btf', label: t('review.side.back') },
        { v: 'mixed', label: t('settings.algo.directionMixed') },
      ], v => { s.direction = v; save(); }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.newPerDay')),
        el('span', null, t('settings.algo.newPerDayHint')),
      ]),
      (() => {
        const inp = el('input', { type: 'number', min: 1, max: 9999, value: s.newPerDay ?? 20 }) as HTMLInputElement;
        inp.addEventListener('change', () => {
          s.newPerDay = Math.max(1, Math.floor(Number(inp.value)) || 20);
          inp.value = String(s.newPerDay);
          save();
        });
        return inp;
      })(),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.reviewsPerDay')),
        el('span', null, t('settings.algo.reviewsPerDayHint')),
      ]),
      (() => {
        const inp = el('input', {
          type: 'number',
          min: 1,
          max: 9999,
          value: s.reviewsPerDay ?? 50,
        }) as HTMLInputElement;
        inp.addEventListener('change', () => {
          s.reviewsPerDay = Math.max(1, Math.floor(Number(inp.value)) || 50);
          inp.value = String(s.reviewsPerDay);
          save();
        });
        return inp;
      })(),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.tts')),
        el('span', null, t('settings.algo.ttsHint')),
      ]),
      el('label', { class: 'chk-wrap' }, ttsInput),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.ttsAuto')),
        ttsAutoHint,
      ]),
      el('label', { class: 'chk-wrap' }, ttsAutoInput),
    ]),
    el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.ttsRate')),
        el('span', null, t('settings.algo.ttsRateHint')),
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

  function syncTtsAutoHint() {
    ttsAutoHint.textContent = ttsInput.checked
      ? t('settings.algo.ttsAutoOn')
      : t('settings.algo.ttsAutoOff');
  }
  syncTtsAutoHint();
  ttsInput.addEventListener('change', syncTtsAutoHint);

  if (s.algo === 'leitner') {
    const row = el('div', { class: 'row leitner-intervals-row' }, []);
    const intervals = s.leitnerIntervals || DEFAULT_SETTINGS.leitnerIntervals;
    intervals.forEach((d: number, i: number) => {
      const inp = el('input', { type: 'number', min: 1, max: 365, value: d, class: 'input leitner-interval-input' }, []) as HTMLInputElement;
      inp.addEventListener('change', () => {
        s.leitnerIntervals[i] = Math.max(1, Number(inp.value) || 1);
        save();
      });
      row.append(el('div', { class: 'text-center' }, [
        el('div', { class: 'muted' }, t('settings.algo.leitnerBoxShort', { n: i + 1 })),
        inp,
      ]));
    });
    algoGroup.append(el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.leitnerIntervals')),
        el('span', null, t('settings.algo.leitnerIntervalsHint')),
      ]),
      row,
    ]));
  }

  if (s.algo === 'fsrs') {
    const retVal = el('span', { class: 'tts-rate-val tnum' }, '');
    const ret0 = Math.min(0.97, Math.max(0.8, Number(s.fsrsRetention ?? 0.9) || 0.9));
    const retRange = el('input', { type: 'range', class: 'tts-rate', min: 0.8, max: 0.97, step: 0.01, value: ret0 }) as HTMLInputElement;
    const setRetLabel = () => { retVal.textContent = Math.round(Number(retRange.value) * 100) + '%'; };
    setRetLabel();
    retRange.addEventListener('input', setRetLabel);
    retRange.addEventListener('change', () => {
      const v = Math.min(0.97, Math.max(0.8, Number(retRange.value) || 0.9));
      s.fsrsRetention = Math.round(v * 100) / 100;
      setRetLabel();
      save();
    });
    algoGroup.append(el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.fsrs.retention')),
        el('span', null, t('settings.algo.fsrs.retentionHint')),
      ]),
      el('div', { class: 'tts-rate-wrap' }, [retVal, retRange]),
    ]));

    const fuzzInput = el('input', { type: 'checkbox', class: 'chk' }, []) as HTMLInputElement;
    fuzzInput.checked = s.fsrsFuzz !== false;
    fuzzInput.addEventListener('change', () => { s.fsrsFuzz = fuzzInput.checked; save(); });
    algoGroup.append(el('div', { class: 'setting-row' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.fsrs.fuzz')),
        el('span', null, t('settings.algo.fsrs.fuzzHint')),
      ]),
      el('label', { class: 'chk-wrap' }, fuzzInput),
    ]));

    const measured = el('span', { class: 'muted' }, t('settings.algo.fsrs.measuredLoading'));
    algoGroup.append(el('div', { class: 'setting-row setting-row-stack' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.fsrs.measured')),
        measured,
      ]),
    ]));
    void (async () => {
      try {
        const [rl, opt] = await Promise.all([
          import('../../../lib/review-log.js'),
          import('../../../lib/fsrs-optimize.js'),
        ]);
        const reviews = await rl.getAllReviews();
        const stats = opt.computeRetentionStats(reviews);
        const adv = opt.suggestRetention(stats);
        const advice = formatRetentionAdvice(adv, stats.reviewRetention);
        measured.textContent = stats.reviewRetention != null
          ? t('settings.algo.fsrs.measuredFact', {
            pct: opt.formatPercent(stats.reviewRetention),
            reviews: tp('settings.algo.fsrs.reviewCount', stats.reviewCount, { n: stats.reviewCount }),
            advice,
          })
          : advice;
      } catch (e) { measured.textContent = t('settings.algo.fsrs.logUnavailable'); }
    })();

    const weightsArea = el('textarea', { class: 'input', rows: 2, placeholder: t('settings.algo.fsrs.weightsPlaceholder') }, []) as HTMLTextAreaElement;
    weightsArea.value = Array.isArray(s.fsrsWeights) && s.fsrsWeights.length ? s.fsrsWeights.join(', ') : '';
    const weightsHint = el('span', { class: 'muted' }, '');
    weightsArea.addEventListener('change', async () => {
      const { parseWeights } = await import('../../../lib/fsrs-optimize.js');
      const w = parseWeights(weightsArea.value);
      if (weightsArea.value.trim() && !w) { weightsHint.textContent = t('settings.algo.fsrs.weightsInvalid'); return; }
      s.fsrsWeights = w;
      weightsHint.textContent = w
        ? tp('settings.algo.fsrs.weightsSaved', w.length, { n: w.length })
        : t('settings.algo.fsrs.weightsReset');
      save();
    });
    const exportBtn = el('button', {
      type: 'button',
      class: 'btn ghost',
      onclick: async () => {
        const [rl, opt] = await Promise.all([
          import('../../../lib/review-log.js'),
          import('../../../lib/fsrs-optimize.js'),
        ]);
        const csv = opt.toOptimizerCsv(await rl.getAllReviews());
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'kar-tochki-revlog.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      },
    }, t('settings.algo.fsrs.exportCsv')) as HTMLButtonElement;
    algoGroup.append(el('div', { class: 'setting-row setting-row-stack' }, [
      el('div', { class: 'lab' }, [
        el('b', null, t('settings.algo.fsrs.weightsTitle')),
        el('span', null, t('settings.algo.fsrs.weightsHint')),
        weightsHint,
      ]),
      el('div', { class: 'fsrs-weights-controls' }, [weightsArea, exportBtn]),
    ]));
  }

  return algoGroup;
}
