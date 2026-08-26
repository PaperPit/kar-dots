// YouTube cards dialog: link or subtitle file → LLM → preview → cards into folder.
// Server: functions/api/yt-video.js, yt-generate.js (see docs/youtube-import-setup.md).

import { store } from '../../core/state.js';
import { el, toast, modal, spinner } from '../../ui/ui.js';
import type { ModalHandle } from '../../ui/ui.js';
import { route } from '../../core/router.js';
import {
  parseYouTubeId,
  filterNewCandidates, filterNewSentences, fmtTimestamp,
  type YtCandidate,
} from '../../lib/youtube-import.js';
import { hasSupadataApiKey, hasGenerateApiKey } from '../../lib/youtube-import-settings.js';
import {
  fetchTranscriptFromUrl, importFromCaptionFile,
  generateYoutubeCards, createYoutubeCardsBatch, prepareTranscriptForMode,
  type YtGenResult,
} from '../../lib/yt-transcript.js';
import type { YtVideo as YTVideo, YtTranscript } from '../../data/yt-transcript-cache.js';
import { loadKnownTermsForImport } from '../../lib/yt-known-terms.js';
import { t, tp } from '../../lib/i18n.js';

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

function sourceTabs() {
  return [
    { id: 'url', label: t('folder.yt.source.url') },
    { id: 'file', label: t('folder.yt.source.file') },
  ];
}

function modes() {
  return [
    { id: 'words', label: t('folder.yt.mode.words') },
    { id: 'phrases', label: t('folder.yt.mode.phrases') },
    { id: 'both', label: t('folder.yt.mode.both') },
    { id: 'sentences', label: t('folder.yt.mode.sentences') },
  ];
}

function sourceHint(src: string): string {
  if (src === 'cache') return t('folder.yt.hint.cache');
  if (src === 'supadata') return t('folder.yt.hint.supadata');
  if (src === 'file') return t('folder.yt.hint.file');
  return '';
}

export function youtubeImportDialog(folderId: string) {
  let closed = false;
  let source = 'url';
  const body = el('div', { class: 'yt-dialog' }, []);

  const titleId = 'yt-import-dialog-title';
  const m: ModalHandle = modal(el('div', null, [
    el('h3', { class: 'modal-title', id: titleId }, t('settings.yt.title')),
    body,
  ]), { wide: true, sticky: true, labelledBy: titleId });

  const origClose = m.close;
  m.close = () => { closed = true; origClose(); };

  renderForm();

  function needsOnline() {
    if (store.offline || !navigator.onLine) {
      return t('folder.yt.needOnline');
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

    const sourceSeg = el('div', { class: 'seg yt-source-seg' }, sourceTabs().map(tab =>
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

    const fileNameEl = el('span', { class: 'yt-file-name' }, t('folder.yt.fileNone'));
    const fileInput = el('input', {
      class: 'yt-file-input-native',
      type: 'file',
      accept: '.srt,.vtt,text/vtt,text/plain',
      tabindex: '-1',
      'aria-hidden': 'true',
      onchange: () => {
        const f = fileInput.files?.[0];
        fileNameEl.textContent = f ? f.name : t('folder.yt.fileNone');
        fileNameEl.classList.toggle('is-set', !!f);
      },
    }, []) as HTMLInputElement;
    const filePickBtn = el('button', {
      type: 'button',
      class: 'btn yt-file-pick-btn',
      onclick: () => fileInput.click(),
    }, t('folder.yt.pickFile')) as HTMLButtonElement;
    const filePicker = el('div', { class: 'yt-file-picker' }, [
      fileInput,
      filePickBtn,
      fileNameEl,
    ]);

    const fileUrlInput = el('input', {
      class: 'input',
      type: 'url',
      inputmode: 'url',
      placeholder: t('folder.yt.urlOptional'),
      value: prefill.fileUrl || '',
    }, []) as HTMLInputElement;

    const titleInput = el('input', {
      class: 'input',
      type: 'text',
      placeholder: t('folder.yt.titleOptional'),
      value: prefill.title || '',
    }, []) as HTMLInputElement;

    const urlPanel = el('div', { class: 'yt-source-panel' + (source === 'url' ? '' : ' hidden') }, [
      el('p', { class: 'modal-text' }, t('folder.yt.urlIntro')),
      el('div', { class: 'field' }, [el('label', null, t('folder.yt.label.url')), urlInput]),
    ]);

    const filePanel = el('div', { class: 'yt-source-panel' + (source === 'file' ? '' : ' hidden') }, [
      el('p', { class: 'modal-text' }, t('folder.yt.fileIntro')),
      el('div', { class: 'field' }, [el('label', null, t('folder.yt.label.file')), filePicker]),
      el('div', { class: 'field' }, [el('label', null, t('folder.yt.label.url')), fileUrlInput]),
      el('div', { class: 'field' }, [el('label', null, t('common.name')), titleInput]),
    ]);

    const modeSeg = el('div', { class: 'seg yt-mode-seg' }, modes().map(mo =>
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
        el('span', null, t('folder.yt.mergeCues')),
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
            errEl.textContent = t('folder.yt.invalidUrl');
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
            errEl.textContent = t('folder.yt.needSupadata');
            errEl.classList.remove('hidden');
            return;
          }
          if (!hasGenerateApiKey(store.settings)) {
            errEl.textContent = t('folder.yt.needGenerate');
            errEl.classList.remove('hidden');
            return;
          }
          runUrlImport(urlInput.value.trim(), mode, mergeCues);
          return;
        }

        const file = fileInput.files?.[0];
        if (!file) {
          errEl.textContent = t('folder.yt.needFile');
          errEl.classList.remove('hidden');
          return;
        }
        const offlineMsg = needsOnline();
        if (offlineMsg) {
          errEl.textContent = offlineMsg;
          errEl.classList.remove('hidden');
          return;
        }
        if (!hasGenerateApiKey(store.settings)) {
          errEl.textContent = t('folder.yt.needGenerate');
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
    }, t('folder.yt.getCards')) as HTMLButtonElement;

    body.innerHTML = '';
    body.append(
      sourceSeg,
      urlPanel,
      filePanel,
      el('div', { class: 'field' }, [el('label', null, t('folder.yt.whatToExtract')), modeSeg]),
      sentencesOpts,
      errEl,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, t('common.cancel')),
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
        el('button', { class: 'btn ghost', onclick: () => m.close() }, t('common.cancel')),
      ]),
    );
    return (msg: string) => { statusEl.textContent = msg; };
  }

  async function finishImport({ video, transcript, source: src, mode, mergeCues, prefill }: { video?: YTVideo; transcript: YtTranscript; source: string; mode: string; mergeCues: boolean; prefill: YTPrefill }) {
    const setStatus = renderProgress(t('folder.yt.progress.compose'), sourceHint(src));
    try {
      const prepared = prepareTranscriptForMode(transcript, mode, { mergeCues });
      const gen: YtGenResult = await generateYoutubeCards(
        { video, transcript: prepared, mode, settings: store.settings },
        { isClosed: (): boolean => closed },
      );
      if (closed) return;

      setStatus(mode === 'sentences'
        ? t('folder.yt.progress.checkSentences')
        : t('folder.yt.progress.checkWords'));
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
    const setStatus = renderProgress(t('folder.yt.progress.fetchVideo'));
    try {
      const result = await fetchTranscriptFromUrl(url, store.settings, {
        isClosed: (): boolean => closed,
        onStatus: (msg?: string): void => { if (msg) setStatus(msg); },
      });
      if (closed) return;
      if (result.source === 'cache') setStatus(t('folder.yt.progress.cacheCompose'));
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
    renderProgress(t('folder.yt.progress.readFile'), sourceHint('file'));
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
        ? t('folder.yt.empty.sentences')
        : t('folder.yt.empty.lexicon');
      body.append(
        el('p', { class: 'modal-text' }, emptyMsg),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn ghost', onclick: () => renderForm(prefill) }, t('folder.yt.otherVideo')),
          el('button', { class: 'btn primary', onclick: () => m.close() }, t('folder.yt.gotIt')),
        ]),
      );
      return;
    }

    const countChecked = () => items.filter((it: YTItem) => it.checkbox.checked).length;
    const refreshAddBtn = () => {
      const n = countChecked();
      addBtn.disabled = n === 0;
      addBtn.textContent = n ? t('folder.yt.addN', { n }) : t('folder.yt.add');
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
        el('label', { class: 'yt-group-title' }, [allChk, el('span', null, t('folder.yt.groupTitle', { title, n: cands.length }))]),
        el('div', { class: 'yt-rows' }, rows.map((r: YTRow) => r.row)),
      ]);
    }

    const addBtn = el('button', {
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
            ? t('folder.yt.toast.addedWithErrors', {
              n: ok,
              cards: tp('common.card', ok),
              failed: failed.length,
            })
            : t('folder.yt.toast.addFailed', {
              n: failed.length,
              errors: tp('folder.yt.errors', failed.length),
            });
          toast(msg, ok ? 'ok' : 'error');
        } else {
          toast(t('folder.yt.toast.added', { n: ok, cards: tp('common.card', ok) }), 'ok');
        }
      },
    }, t('folder.yt.add')) as HTMLButtonElement;

    const hintText = prefill.transcriptSource ? sourceHint(prefill.transcriptSource) : '';
    const sourceHintEl = hintText
      ? el('p', { class: 'yt-source-hint muted' }, hintText)
      : null;

    const droppedMsg = dropped > 0
      ? el('p', { class: 'yt-dropped muted' }, prefill.mode === 'sentences'
        ? tp('folder.yt.dropped.sentences', dropped)
        : tp('folder.yt.dropped.words', dropped))
      : null;

    const truncatedMsg = truncated && truncated.total > truncated.used
      ? el('p', { class: 'yt-dropped muted' },
        t('folder.yt.truncated', { used: truncated.used, total: truncated.total }))
      : null;

    const previewExtras: HTMLElement[] = [];
    if (sourceHintEl) previewExtras.push(sourceHintEl);
    if (droppedMsg) previewExtras.push(droppedMsg);
    if (truncatedMsg) previewExtras.push(truncatedMsg);

    body.append(
      el('p', { class: 'yt-video-title' }, video?.title || 'YouTube video'),
      ...previewExtras,
      el('div', { class: 'yt-preview' }, [
        group(t('folder.yt.group.sentences'), sentences),
        group(t('folder.yt.group.phrases'), phrases),
        group(t('folder.yt.group.words'), words),
      ].filter(Boolean)),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, t('common.cancel')),
        addBtn,
      ]),
    );
    refreshAddBtn();
  }
}
