// Диалог «Карточки из YouTube»: ссылка → транскрипт → LLM → превью → карточки в папку.
// Серверная часть: netlify/functions/yt-video.mjs, yt-generate.mjs (см. docs/youtube-import-setup.md).

import { store } from '../../core/state.js';
import { el, toast, modal, spinner, plural } from '../../ui/ui.js';
import { route } from '../../core/router.js';
import { fetchPackManifest, isVocabPackFolder } from '../../lib/vocab-packs.js';
import {
  parseYouTubeId, collectKnownTerms, isYoutubeCard,
  filterNewCandidates, buildCardDescription, fmtTimestamp,
} from '../../lib/youtube-import.js';

const POLL_MS = 2500;
const POLL_MAX_MS = 3 * 60 * 1000;

const MODES = [
  { id: 'words', label: 'Слова' },
  { id: 'phrases', label: 'Фразы' },
  { id: 'both', label: 'Слова + фразы' },
];

async function apiJson(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error('Нет соединения с сервером');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* не JSON */ }
  if (!res.ok || data?.error) {
    throw new Error(data?.message || 'Ошибка сервера (' + res.status + ')');
  }
  return data;
}

/** Все известные слова: встроенные паки (все 4) + YouTube-карточки + текущая папка. */
async function loadKnownTerms(folderId) {
  const sources = [];
  try {
    const manifest = await fetchPackManifest();
    for (const meta of manifest.packs || []) {
      try {
        const res = await fetch('packs/' + meta.file, { cache: 'no-cache' });
        if (res.ok) sources.push((await res.json()).cards || []);
      } catch (e) { /* пак недоступен — пропускаем */ }
    }
  } catch (e) { /* каталог недоступен — сверяем по папкам */ }

  for (const f of store.folders) {
    if (isVocabPackFolder(f)) continue; // содержимое пака уже взяли из JSON
    try {
      const cards = await store.getFolderCards(f.id);
      sources.push(f.id === folderId ? cards : cards.filter(isYoutubeCard));
    } catch (e) { /* папка не прочиталась — пропускаем */ }
  }
  return collectKnownTerms(sources);
}

export function youtubeImportDialog(folderId) {
  let m;
  let closed = false;
  const body = el('div', { class: 'yt-dialog' });

  m = modal(el('div', null, [
    el('h3', { class: 'modal-title' }, 'Карточки из YouTube'),
    body,
  ]), { wide: true, sticky: true });

  const origClose = m.close;
  m.close = () => { closed = true; origClose(); };

  renderForm();

  // ---------- фаза 1: форма ----------
  function renderForm(prefill = {}) {
    let mode = prefill.mode || 'both';

    const urlInput = el('input', {
      class: 'input',
      type: 'url',
      inputmode: 'url',
      placeholder: 'https://www.youtube.com/watch?v=…',
      value: prefill.url || '',
    });

    const seg = el('div', { class: 'seg yt-mode-seg' }, MODES.map(mo =>
      el('button', {
        type: 'button',
        class: mo.id === mode ? 'active' : '',
        onclick: e => {
          mode = mo.id;
          seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
        },
      }, mo.label)
    ));

    const errEl = el('p', { class: 'yt-error' + (prefill.error ? '' : ' hidden') }, prefill.error || '');

    const goBtn = el('button', {
      class: 'btn primary',
      onclick: () => {
        const id = parseYouTubeId(urlInput.value);
        if (!id) {
          errEl.textContent = 'Не похоже на ссылку на YouTube-видео';
          errEl.classList.remove('hidden');
          return;
        }
        if (store.offline || !navigator.onLine) {
          errEl.textContent = 'Нужно подключение к интернету';
          errEl.classList.remove('hidden');
          return;
        }
        runImport(urlInput.value.trim(), mode);
      },
    }, 'Получить карточки');

    body.innerHTML = '';
    body.append(
      el('p', { class: 'modal-text' }, 'Вставь ссылку на ролик до 20 минут — выберу из него лексику, которой ещё нет в твоих паках.'),
      el('div', { class: 'field' }, [el('label', null, 'Ссылка на видео'), urlInput]),
      el('div', { class: 'field' }, [el('label', null, 'Что достать из ролика'), seg]),
      errEl,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
        goBtn,
      ]),
    );
    setTimeout(() => urlInput.focus(), 260);
  }

  // ---------- фаза 2: загрузка ----------
  function renderProgress(text) {
    body.innerHTML = '';
    const statusEl = el('p', { class: 'yt-status' }, text);
    body.append(
      el('div', { class: 'yt-progress' }, [spinner(28), statusEl]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onclick: () => m.close() }, 'Отмена'),
      ]),
    );
    return t => { statusEl.textContent = t; };
  }

  async function runImport(url, mode) {
    const setStatus = renderProgress('Получаю данные видео…');
    try {
      // 1. метаданные + транскрипт (с ожиданием AI-расшифровки, если субтитров нет)
      let data = await apiJson('/api/yt-video', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const video = data.video;
      if (data.pending) {
        setStatus('Субтитров нет — расшифровываю аудио, это может занять минуту…');
        const deadline = Date.now() + POLL_MAX_MS;
        while (data.pending) {
          if (closed) return;
          if (Date.now() > deadline) throw new Error('Расшифровка заняла слишком много времени — попробуй позже');
          await new Promise(r => setTimeout(r, POLL_MS));
          data = await apiJson('/api/yt-video?jobId=' + encodeURIComponent(data.jobId));
        }
      }
      if (closed) return;
      const transcript = data.transcript;
      if (!transcript?.segments?.length) throw new Error('Не удалось получить текст видео');

      // 2. генерация кандидатов
      setStatus('Составляю карточки…');
      const gen = await apiJson('/api/yt-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: video?.title || '',
          lang: transcript.lang || '',
          mode,
          segments: transcript.segments,
        }),
      });
      if (closed) return;

      // 3. сверка с паками и прошлыми YouTube-импортами
      setStatus('Проверяю, какие слова для тебя новые…');
      const known = await loadKnownTerms(folderId);
      if (closed) return;
      const { phrases, words } = filterNewCandidates(gen.cards, known);
      const dropped = gen.cards.length - phrases.length - words.length;
      renderPreview(video, phrases, words, dropped, { url, mode });
    } catch (e) {
      if (closed) return;
      renderForm({ url, mode, error: e.message });
    }
  }

  // ---------- фаза 3: превью ----------
  function renderPreview(video, phrases, words, dropped, prefill) {
    body.innerHTML = '';
    const items = []; // { cand, checkbox, backInput }

    if (!phrases.length && !words.length) {
      body.append(
        el('p', { class: 'modal-text' }, 'Вся лексика из этого ролика уже есть в твоих паках и папках — новых карточек не нашлось.'),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn ghost', onclick: () => renderForm(prefill) }, 'Другое видео'),
          el('button', { class: 'btn primary', onclick: () => m.close() }, 'Понятно'),
        ]),
      );
      return;
    }

    let addBtn;
    const countChecked = () => items.filter(it => it.checkbox.checked).length;
    const refreshAddBtn = () => {
      const n = countChecked();
      addBtn.disabled = n === 0;
      addBtn.textContent = n ? `Добавить (${n})` : 'Добавить';
    };

    function group(title, cands) {
      if (!cands.length) return null;
      const allChk = el('input', { type: 'checkbox', class: 'chk', checked: true });
      const rows = cands.map(c => {
        const chk = el('input', { type: 'checkbox', class: 'chk', checked: true, onchange: () => {
          allChk.checked = cands.every((_, i) => rowsItems[i].checkbox.checked);
          refreshAddBtn();
        } });
        const backInput = el('input', { class: 'input yt-back-input', value: c.back });
        const chipText = [c.level, c.kind === 'phrase' ? 'phrase' : c.pos].filter(Boolean).join(' · ');
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
        const item = { cand: c, checkbox: chk, backInput };
        items.push(item);
        return { row, item };
      });
      const rowsItems = rows.map(r => r.item);
      allChk.addEventListener('change', () => {
        rowsItems.forEach(it => { it.checkbox.checked = allChk.checked; });
        refreshAddBtn();
      });
      return el('div', { class: 'yt-group' }, [
        el('label', { class: 'yt-group-title' }, [allChk, el('span', null, `${title} (${cands.length})`)]),
        el('div', { class: 'yt-rows' }, rows.map(r => r.row)),
      ]);
    }

    addBtn = el('button', {
      class: 'btn primary',
      onclick: async () => {
        const selected = items.filter(it => it.checkbox.checked);
        if (!selected.length) return;
        addBtn.disabled = true;
        addBtn.innerHTML = '';
        addBtn.append(spinner(16));
        try {
          let ok = 0;
          for (const it of selected) {
            const back = it.backInput.value.trim();
            if (!back) continue;
            await store.createCard({
              folder_id: folderId,
              front: it.cand.front,
              back,
              description: buildCardDescription(it.cand, video?.videoId),
            });
            ok++;
          }
          m.close();
          await route();
          toast(`Добавлено ${ok} ${plural(ok, 'карточка', 'карточки', 'карточек')}`, 'ok');
        } catch (e) {
          toast(e.message, 'error');
          addBtn.disabled = false;
          refreshAddBtn();
        }
      },
    }, 'Добавить');

    body.append(
      el('p', { class: 'yt-video-title' }, video?.title || 'YouTube video'),
      dropped > 0 ? el('p', { class: 'yt-dropped muted' },
        `${dropped} ${plural(dropped, 'слово уже есть', 'слова уже есть', 'слов уже есть')} в твоих паках — они скрыты.`) : null,
      el('div', { class: 'yt-preview' }, [
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
