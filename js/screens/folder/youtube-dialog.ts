// Диалог «Карточки из YouTube»: ссылка или файл субтитров → LLM → превью → карточки в папку.
// Серверная часть: netlify/functions/yt-video.mjs, yt-generate.mjs (см. docs/youtube-import-setup.md).

import { store } from '../../core/state.js';
import { el, toast, modal, spinner, plural } from '../../ui/ui.js';
import type { ModalHandle } from '../../ui/ui.js';
import { route } from '../../core/router.js';
import {
  parseYouTubeId,
  filterNewCandidates, filterNewSentences, fmtTimestamp,
  type YtCandidate,
} from '../../lib/youtube-import.js';
import { hasSupadataApiKey } from '../../lib/youtube-import-settings.js';
import {
  fetchTranscriptFromUrl, importFromCaptionFile,
  generateYoutubeCards, createYoutubeCardsBatch, prepareTranscriptForMode,
  type YtGenResult,
} from '../../lib/yt-transcript.js';
import type { YtVideo as YTVideo, YtTranscript } from '../../data/yt-transcript-cache.js';
import { loadKnownTermsForImport } from '../../lib/yt-known-terms.js';

interface YTPrefill {
  source?: string;
  mode?: string;
  mergeCues?: boolean;
  url?: string;
  fileUrl?: string;
  title?: string;
  error?: string;
  transcriptSource?: string;
}

interface YTItem {
  cand: YtCandidate;
  checkbox: HTMLInputElement;
  backInput: HTMLInputElement;
}

interface YTRow {
  row: HTMLElement;
  item: YTItem;
}

interface YTFileImportArg {
  url: string;
  title: string;
  mode: string;
  mergeCues: boolean;
}

const SOURCE_TABS = [
  { id: 'url', label: 'Ссылка' },
  { id: 'file', label: 'Файл субтитров' },
];

const MODES = [
  { id: 'words', label: 'Слова' },
  { id: 'phrases', label: 'Фразы' },
  { id: 'both', label: 'Слова + фразы' },
  { id: 'sentences', label: 'Предложения' },
];

const SOURCE_HINTS: Record<string, string> = {
  cache: 'Транскрипт из кэша',
  supadata: 'Транскрипт через Supadata',
  file: 'Субтитры из файла',
};

export function youtubeImportDialog(folderId: string) {
  let m: ModalHandle;
  let closed = false;
  let source = 'url';
  const body = el('div', { class: 'yt-dialog' }, []);

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, 'Карточки из YouTube'),
    body,
  ]), { wide: true, sticky: true });

  const origClose = m.close;
  m.close = () => { closed = true; origClose(); };

  renderForm();

  function needsOnline() {
    if (store.offline || !navigator.onLine) {
      return 'Нужно подключение к интернету';
    }
    return null;
  }

  function renderForm(prefill: YTPrefill = {}) {
    source = prefill.source || source;
    let mode = prefill.mode || 'both';
    let mergeCues = prefill.mergeCues !== false;

    const syncSentencesOptions = () => {
      sentencesOpts.classList.toggle('hidden', mode !== 'sentences');
      mergeChk.checked = mergeCues;
    };

    const sourceSeg = el('div', { class: 'seg yt-source-seg' }, SOURCE_TABS.map(tab =>
      el('button', {
        type: 'button',
        class: tab.id === source ? 'active' : '',
        onclick: (e: Event) => {
          source = tab.id;
          sourceSeg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          (e.currentTarget as HTMLElement).classList.add('active');
          urlPanel.classList.toggle('hidden', source !== 'url');
          filePanel.classList.toggle('hidden', source !== 'file');
          errEl.classList.add('hidden');
        },
      }, tab.label)
    ));

    const urlInput = el('input', {
      class: 'input',
      type: 'url',
      inputmode: 'url',
      placeholder: 'https://www.youtube.com/watch?v=…',
      value: prefill.url || '',
    }, []) as HTMLInputElement;

    const fileNameEl = el('span', { class: 'yt-file-name' }, 'Файл не выбран');
    const fileInput = el('input', {
      class: 'yt-file-input-native',
      type: 'file',
      accept: '.srt,.vtt,text/vtt,text/plain',
      tabindex: '-1',
      'aria-hidden': 'true',
      onchange: () => {
        const f = fileInput.files?.[0];
        fileNameEl.textContent = f ? f.name : 'Файл не выбран';
        fileNameEl.classList.toggle('is-set', !!f);
      },
    }, []) as HTMLInputElement;
    const filePickBtn = el('button', {
      type: 'button',
      class: 'btn yt-file-pick-btn',
      onclick: () => fileInput.click(),
    }, 'Выбрать файл') as HTMLButtonElement;
    const filePicker = el('div', { class: 'yt-file-picker' }, [
      fileInput,
      filePickBtn,
      fileNameEl,
    ]);

    const fileUrlInput = el('input', {
      class: 'input',
      type: 'url',
      inputmode: 'url',
      placeholder: 'https://www.youtube.com/watch?v=… (необязательно)',
      value: prefill.fileUrl || '',
    }, []) as HTMLInputElement;

    const titleInput = el('input', {
      class: 'input',
      type: 'text',
      placeholder: 'Название видео (необязательно)',
      value: prefill.title || '',
    }, []) as HTMLInputElement;

    const urlPanel = el('div', { class: 'yt-source-panel' + (source === 'url' ? '' : ' hidden') }, [
      el('p', { class: 'modal-text' }, 'Вставь ссылку на ролик до 20 минут — выберу из него лексику, которой ещё нет в твоих паках.'),
      el('div', { class: 'field' }, [el('label', null, 'Ссылка на видео'), urlInput]),
    ]);

    const filePanel = el('div', { class: 'yt-source-panel' + (source === 'file' ? '' : ' hidden') }, [
      el('p', { class: 'modal-text' }, 'Загрузи .srt или .vtt — Supadata не нужен. Ссылку можно добавить для таймкодов в карточках.'),
      el('div', { class: 'field' }, [el('label', null, 'Файл субтитров'), filePicker]),
      el('div', { class: 'field' }, [el('label', null, 'Ссылка на видео'), fileUrlInput]),
      el('div', { class: 'field' }, [el('label', null, 'Название'), titleInput]),
    ]);

    const modeSeg = el('div', { class: 'seg yt-mode-seg' }, MODES.map(mo =>
      el('button', {
        type: 'button',
        class: mo.id === mode ? 'active' : '',
        onclick: (e: Event) => {
          mode = mo.id;
          modeSeg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          (e.currentTarget as HTMLElement).classList.add('active');
          syncSentencesOptions();
        },
      }, mo.label)
    ));

    const mergeChk = el('input', {
      type: 'checkbox',
      class: 'chk',
      checked: mergeCues,
      onchange: () => { mergeCues = mergeChk.checked; },
    }, []) as HTMLInputElement;
    const sentencesOpts = el('div', { class: 'yt-sentences-options' + (mode === 'sentences' ? '' : ' hidden') }, [
      el('label', { class: 'yt-check-label' }, [
        mergeChk,
        el('span', null, 'Склеивать короткие реплики в предложения'),
      ]),
    ]);

    const errEl = el('p', { class: 'yt-error' + (prefill.error ? '' : ' hidden') }, prefill.error || '');

    const goBtn = el('button', {
      class: 'btn primary',
      onclick: () => {
        errEl.classList.add('hidden');
        if (source === 'url') {
          const id = parseYouTubeId(urlInput.value);
          if (!id) {
            errEl.textContent = 'Не похоже на ссылку на YouTube-видео';
            errEl.classList.remove('hidden');
            return;
          }
          const offlineMsg = needsOnline();
          if (offlineMsg) {
            errEl.textContent = offlineMsg;
            errEl.classList.remove('hidden');
            return;
          }
          if (!hasSupadataApiKey(store.settings)) {
            errEl.textContent = 'Укажи Supadata API ключ: Настройки → «Карточки из YouTube» → «Настроить»';
            errEl.classList.remove('hidden');
            return;
          }
          runUrlImport(urlInput.value.trim(), mode, mergeCues);
          return;
        }

        const file = fileInput.files?.[0];
        if (!file) {
          errEl.textContent = 'Выбери файл .srt или .vtt';
          errEl.classList.remove('hidden');
          return;
        }
        const offlineMsg = needsOnline();
        if (offlineMsg) {
          errEl.textContent = offlineMsg;
          errEl.classList.remove('hidden');
          return;
        }
        runFileImport(file, {
          url: fileUrlInput.value.trim(),
          title: titleInput.value.trim(),
          mode,
          mergeCues,
        });
      },
    }, 'Получить карточки') as HTMLButtonElement;

    body.innerHTML = '';
    body.append(
      sourceSeg,
      urlPanel,
      filePanel,
      el('div', { class: 'field' }, [el('label', null, 'Что достать из ролика'), modeSeg]),
      sentencesOpts,
      errEl,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
        goBtn,
      ]),
    );
    setTimeout(() => (source === 'url' ? urlInput : filePickBtn).focus(), 260);
  }

  function renderProgress(text: string, hint: string = '') {
    body.innerHTML = '';
    const statusEl = el('p', { class: 'yt-status' }, text);
    const hintEl = hint
      ? el('p', { class: 'yt-source-hint muted' }, hint)
      : null;
    body.append(
      el('div', { class: 'yt-progress' }, [spinner(28), statusEl, hintEl].filter(Boolean)),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      ]),
    );
    return (t: string) => { statusEl.textContent = t; };
  }

  async function finishImport({ video, transcript, source: src, mode, mergeCues, prefill }: { video?: YTVideo; transcript: YtTranscript; source: string; mode: string; mergeCues: boolean; prefill: YTPrefill }) {
    const setStatus = renderProgress('Составляю карточки…', SOURCE_HINTS[src] || '');
    try {
      const prepared = prepareTranscriptForMode(transcript, mode, { mergeCues });
      const gen: YtGenResult = await generateYoutubeCards(
        { video, transcript: prepared, mode, settings: store.settings },
        { isClosed: (): boolean => closed },
      );
      if (closed) return;

      setStatus(mode === 'sentences'
        ? 'Проверяю, какие предложения для тебя новые…'
        : 'Проверяю, какие слова для тебя новые…');
      const known = await loadKnownTermsForImport(store, folderId);
      if (closed) return;

      if (mode === 'sentences') {
        const sentences = filterNewSentences(gen.cards, known);
        const dropped = gen.cards.length - sentences.length;
        renderPreview(video, [], [], dropped, { ...prefill, mode, mergeCues, transcriptSource: src }, sentences, gen.truncated);
      } else {
        const { phrases, words } = filterNewCandidates(gen.cards, known);
        const dropped = gen.cards.length - phrases.length - words.length;
        renderPreview(video, phrases, words, dropped, { ...prefill, mode, mergeCues, transcriptSource: src });
      }
    } catch (e) {
      if (closed) return;
      renderForm({ ...prefill, mode, mergeCues, error: e instanceof Error ? e.message : String(e) });
    }
  }

  async function runUrlImport(url: string, mode: string, mergeCues: boolean) {
    const setStatus = renderProgress('Получаю данные видео…');
    try {
      const result = await fetchTranscriptFromUrl(url, store.settings, {
        isClosed: (): boolean => closed,
        onStatus: (msg?: string): void => { if (msg) setStatus(msg); },
      });
      if (closed) return;
      if (result.source === 'cache') setStatus('Транскрипт из кэша — составляю карточки…');
      await finishImport({
        video: result.video,
        transcript: result.transcript,
        source: result.source,
        mode,
        mergeCues,
        prefill: { url, mode, mergeCues, source: 'url' },
      });
    } catch (e) {
      if (closed) return;
      renderForm({ url, mode, mergeCues, source: 'url', error: e instanceof Error ? e.message : String(e) });
    }
  }

  async function runFileImport(file: File, { url, title, mode, mergeCues }: YTFileImportArg) {
    renderProgress('Читаю файл субтитров…', SOURCE_HINTS.file);
    try {
      const text = await file.text();
      const result = importFromCaptionFile(text, file.name, { url, title });
      if (closed) return;
      await finishImport({
        video: result.video,
        transcript: result.transcript,
        source: result.source,
        mode,
        mergeCues,
        prefill: { fileUrl: url, title, mode, mergeCues, source: 'file' },
      });
    } catch (e) {
      if (closed) return;
      renderForm({ fileUrl: url, title, mode, mergeCues, source: 'file', error: e instanceof Error ? e.message : String(e) });
    }
  }

  function renderPreview(video: YTVideo | null | undefined, phrases: YtCandidate[], words: YtCandidate[], dropped: number, prefill: YTPrefill, sentences: YtCandidate[] = [], truncated: { total: number; used: number } | null = null) {
    body.innerHTML = '';
    const items: YTItem[] = [];

    if (!phrases.length && !words.length && !sentences.length) {
      const emptyMsg = prefill.mode === 'sentences'
        ? 'Все предложения из этого ролика уже есть в твоих папках — новых карточек не нашлось.'
        : 'Вся лексика из этого ролика уже есть в твоих паках и папках — новых карточек не нашлось.';
      body.append(
        el('p', { class: 'modal-text' }, emptyMsg),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn ghost', onclick: () => renderForm(prefill) }, 'Другое видео'),
          el('button', { class: 'btn primary', onclick: () => m.close() }, 'Понятно'),
        ]),
      );
      return;
    }

    let addBtn: HTMLButtonElement;
    const countChecked = () => items.filter((it: YTItem) => it.checkbox.checked).length;
    const refreshAddBtn = () => {
      const n = countChecked();
      addBtn.disabled = n === 0;
      addBtn.textContent = n ? `Добавить (${n})` : 'Добавить';
    };

    function group(title: string, cands: YtCandidate[]) {
      if (!cands.length) return null;
      const allChk = el('input', { type: 'checkbox', class: 'chk', checked: true }, []) as HTMLInputElement;
      const rows: YTRow[] = cands.map((c: YtCandidate) => {
        const chk = el('input', { type: 'checkbox', class: 'chk', checked: true, onchange: () => {
          allChk.checked = cands.every((_: unknown, i: number) => rowsItems[i]!.checkbox.checked);
          refreshAddBtn();
        } }, []) as HTMLInputElement;
        const backInput = el('input', { class: 'input yt-back-input', value: c.back }, []) as HTMLInputElement;
        const chipText = c.kind === 'sentence'
          ? [c.level, 'sentence'].filter(Boolean).join(' · ')
          : [c.level, c.kind === 'phrase' ? 'phrase' : c.pos].filter(Boolean).join(' · ');
        const row = el('div', { class: 'yt-row' }, [
          chk,
          el('div', { class: 'yt-row-main' }, [
            el('div', { class: 'yt-row-top' }, [
              el('span', { class: 'yt-row-front' }, c.front),
              chipText ? el('span', { class: 'yt-chip' }, chipText) : null,
              c.t !== null && c.t !== undefined
                ? el('span', { class: 'yt-chip yt-chip-time' }, '▶ ' + fmtTimestamp(c.t)) : null,
            ]),
            backInput,
          ]),
        ]);
        const item: YTItem = { cand: c, checkbox: chk, backInput };
        items.push(item);
        return { row, item };
      });
      const rowsItems = rows.map((r: YTRow) => r.item);
      allChk.addEventListener('change', () => {
        rowsItems.forEach((it: YTItem) => { it.checkbox.checked = allChk.checked; });
        refreshAddBtn();
      });
      return el('div', { class: 'yt-group' }, [
        el('label', { class: 'yt-group-title' }, [allChk, el('span', null, `${title} (${cands.length})`)]),
        el('div', { class: 'yt-rows' }, rows.map((r: YTRow) => r.row)),
      ]);
    }

    addBtn = el('button', {
      class: 'btn primary',
      onclick: async () => {
        const selected = items.filter((it: YTItem) => it.checkbox.checked).map(it => ({
          cand: it.cand,
          back: it.backInput.value,
        }));
        if (!selected.length) return;
        addBtn.disabled = true;
        addBtn.innerHTML = '';
        addBtn.append(spinner(16));
        const { ok, failed } = await createYoutubeCardsBatch(
          (card: { folder_id: string; front: string; back: string; description: string }) => store.createCard(card as never),
          folderId,
          selected,
          video?.videoId ?? null,
        );
        if (closed) return;
        m.close();
        await route();
        if (failed.length) {
          const msg = ok
            ? `Добавлено ${ok} ${plural(ok, 'карточка', 'карточки', 'карточек')}, ошибок ${failed.length}`
            : `Не удалось добавить карточки (${failed.length} ${plural(failed.length, 'ошибка', 'ошибки', 'ошибок')})`;
          toast(msg, ok ? 'ok' : 'error');
        } else {
          toast(`Добавлено ${ok} ${plural(ok, 'карточка', 'карточки', 'карточек')}`, 'ok');
        }
      },
    }, 'Добавить') as HTMLButtonElement;

    const sourceHint = prefill.transcriptSource && SOURCE_HINTS[prefill.transcriptSource]
      ? el('p', { class: 'yt-source-hint muted' }, SOURCE_HINTS[prefill.transcriptSource])
      : null;

    const droppedMsg = dropped > 0
      ? el('p', { class: 'yt-dropped muted' }, prefill.mode === 'sentences'
        ? `${dropped} ${plural(dropped, 'предложение уже есть', 'предложения уже есть', 'предложений уже есть')} в твоих папках — ${plural(dropped, 'оно', 'они', 'они')} скрыты.`
        : `${dropped} ${plural(dropped, 'слово уже есть', 'слова уже есть', 'слов уже есть')} в твоих паках — они скрыты.`)
      : null;

    const truncatedMsg = truncated && truncated.total > truncated.used
      ? el('p', { class: 'yt-dropped muted' },
        `Переведены первые ${truncated.used} из ${truncated.total} предложений — лимит за один импорт.`)
      : null;

    const previewExtras: HTMLElement[] = [];
    if (sourceHint) previewExtras.push(sourceHint);
    if (droppedMsg) previewExtras.push(droppedMsg);
    if (truncatedMsg) previewExtras.push(truncatedMsg);

    body.append(
      el('p', { class: 'yt-video-title' }, video?.title || 'YouTube video'),
      ...previewExtras,
      el('div', { class: 'yt-preview' }, [
        group('Предложения', sentences),
        group('Фразы', phrases),
        group('Слова', words),
      ].filter(Boolean)),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
        addBtn,
      ]),
    );
    refreshAddBtn();
  }
}
