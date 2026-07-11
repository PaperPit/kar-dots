// Netlify Function: генерация карточек из транскрипта через Gemini.
// POST { title, lang, mode: 'words'|'phrases'|'both', segments: [{t, text}] }
//   → { cards: [{ front, back, pos, level, kind, t }] }
//
// Ключи: GEMINI_API_KEY (обязательно), GEMINI_MODEL (опционально, по умолчанию gemini-flash-latest —
// авто-обновляемый алиас на актуальную flash-модель, чтобы не ловить "model no longer available"
// при следующей смене поколений; см. docs/youtube-import-setup.md).

const DEFAULT_MODEL = 'gemini-flash-latest';
const MAX_TRANSCRIPT_CHARS = 28000;
const LIMITS = { words: 50, phrases: 30, bothWords: 40, bothPhrases: 20 };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function err(code, message, status = 400) {
  return json({ error: code, message }, status);
}

/** Склеивает сегменты в строки «[сек] текст» ~по 200 символов, режет по общему лимиту. */
export function compactTranscript(segments, maxChars = MAX_TRANSCRIPT_CHARS) {
  const lines = [];
  let curT = null;
  let curText = '';
  for (const s of segments || []) {
    const text = String(s.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (curT === null) { curT = Math.max(0, Math.round(s.t || 0)); }
    curText = curText ? curText + ' ' + text : text;
    if (curText.length >= 200) {
      lines.push(`[${curT}] ${curText}`);
      curT = null;
      curText = '';
    }
  }
  if (curText) lines.push(`[${curT || 0}] ${curText}`);
  let out = lines.join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars);
  return out;
}

function buildPrompt({ title, lang, mode, transcript }) {
  const wantWords = mode === 'words' || mode === 'both';
  const wantPhrases = mode === 'phrases' || mode === 'both';
  const maxWords = mode === 'both' ? LIMITS.bothWords : LIMITS.words;
  const maxPhrases = mode === 'both' ? LIMITS.bothPhrases : LIMITS.phrases;

  const parts = [];
  parts.push(
    'You extract vocabulary flashcards for a Russian-speaking language learner from a video transcript.',
    `Video title: ${title || 'unknown'}. Transcript language: ${lang || 'unknown (detect it)'}.`,
    'Transcript lines are formatted as "[seconds] text".',
    '',
  );
  if (wantWords) {
    parts.push(
      `WORDS: select up to ${maxWords} single words that are actually used in the transcript and useful to learn.`,
      '- front: the dictionary base form (lemma) in the source language, lowercase (no "to " prefix for verbs).',
      '- Exclude: proper nouns, brand names, numbers, filler words, and very common beginner vocabulary (CEFR A0–A2) — the learner already knows those. Prefer B1+ or topic-specific words.',
      '',
    );
  }
  if (wantPhrases) {
    parts.push(
      `PHRASES: select up to ${maxPhrases} multi-word expressions actually spoken in the transcript: phrasal verbs, collocations, idioms, set expressions (2–5 words).`,
      '- front: the phrase in its neutral base form in the source language.',
      '- Exclude greetings and trivial A0–A2 phrases ("thank you", "how are you").',
      '',
    );
  }
  parts.push(
    'For every item also provide:',
    '- back: concise Russian translation, 1–3 variants separated by " / ".',
    '- pos: for words one of: "сущ.", "гл.", "прил.", "нар.", "предл.", "мест.", "союз", "числ.", "межд.", "фраз. гл."; for phrases always "phrase".',
    '- level: CEFR estimate, one of A1, A2, B1, B2, C1, C2.',
    '- kind: "word" or "phrase".',
    '- t: integer — the [seconds] marker of the line where the item first occurs.',
    '',
    'Return ONLY a JSON array of objects {front, back, pos, level, kind, t}. No other text.',
    '',
    'TRANSCRIPT:',
    transcript,
  );
  return parts.join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      front: { type: 'STRING' },
      back: { type: 'STRING' },
      pos: { type: 'STRING' },
      level: { type: 'STRING' },
      kind: { type: 'STRING' },
      t: { type: 'INTEGER' },
    },
    required: ['front', 'back', 'kind'],
  },
};

async function callGemini(apiKey, model, prompt, withThinkingConfig) {
  const generationConfig = {
    temperature: 0.3,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
  };
  if (withThinkingConfig) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
    },
  );
  let body = null;
  try { body = await res.json(); } catch (e) { /* пусто */ }
  return { status: res.status, body };
}

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

function normalizeCards(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw) {
    const front = String(c?.front || '').trim();
    const back = String(c?.back || '').trim();
    if (!front || !back) continue;
    const kind = c.kind === 'phrase' ? 'phrase' : 'word';
    const level = VALID_LEVELS.has(String(c.level || '').toUpperCase()) ? String(c.level).toUpperCase() : '';
    const t = Number.isFinite(Number(c.t)) ? Math.max(0, Math.round(Number(c.t))) : null;
    const pos = kind === 'phrase' ? 'phrase' : String(c.pos || '').trim().slice(0, 24);
    out.push({ front, back, pos, level, kind, t });
  }
  return out;
}

// ---------- точные таймкоды ----------
// Gemini видит транскрипт, склеенный в строки ~по 200 символов с одной меткой на строку,
// поэтому её `t` промахивается на десятки секунд. Ищем первое реальное вхождение
// слова/фразы в исходных сегментах субтитров и берём время оттуда.

function normText(s) {
  return String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Вероятные формы слова в речи: walk → walks/walked/walking/…; study → studies/studied. */
function spokenForms(word) {
  const w = normText(word);
  const out = new Set([w]);
  if (!w || w.includes(' ')) return out;
  out.add(w + 's');
  out.add(w + 'es');
  out.add(w + 'ed');
  out.add(w + 'd');
  out.add(w + 'ing');
  if (w.endsWith('e')) {
    out.add(w.slice(0, -1) + 'ing'); // love → loving
  }
  if (w.endsWith('y') && w.length > 2) {
    out.add(w.slice(0, -1) + 'ies'); // study → studies
    out.add(w.slice(0, -1) + 'ied'); // study → studied
  }
  const last = w[w.length - 1];
  if (/[bdgmnprt]/.test(last)) {
    out.add(w + last + 'ed');  // stop → stopped
    out.add(w + last + 'ing'); // run → running
  }
  return out;
}

function boundaryRe(term) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`, 'u');
}

/** Переписывает card.t временем сегмента с первым вхождением front; фоллбэк — t от Gemini. */
export function resolveTimestamps(cards, segments) {
  const segs = (Array.isArray(segments) ? segments : [])
    .map(s => ({ t: Math.max(0, Math.round(Number(s?.t) || 0)), text: normText(s?.text) }))
    .filter(s => s.text);
  if (!segs.length) return cards;

  // фразы могут разрываться границей сегмента — проверяем и склейку с соседним
  const joined = segs.map((s, i) => (i + 1 < segs.length ? s.text + ' ' + segs[i + 1].text : s.text));

  function findFirst(res, usePairs) {
    for (let i = 0; i < segs.length; i++) {
      const hay = usePairs ? joined[i] : segs[i].text;
      for (const re of res) if (re.test(hay)) return segs[i].t;
    }
    return null;
  }

  return cards.map(card => {
    const n = normText(card.front);
    if (!n) return card;
    let t = null;
    if (card.kind === 'phrase' || n.includes(' ')) {
      t = findFirst([boundaryRe(n)], true);
      if (t === null) {
        // фраза сказана в другой форме («came up with») — ищем место,
        // где рядом встречается больше всего слов фразы
        const wordRes = n.split(' ')
          .filter(w => w.length > 1)
          .map(w => [...spokenForms(w)].map(boundaryRe));
        if (wordRes.length) {
          let best = { count: 0, t: null };
          for (let i = 0; i < segs.length; i++) {
            let count = 0;
            for (const res of wordRes) if (res.some(re => re.test(joined[i]))) count++;
            if (count > best.count) best = { count, t: segs[i].t };
          }
          if (best.count >= Math.min(2, wordRes.length)) t = best.t;
        }
      }
    } else {
      t = findFirst([...spokenForms(n)].map(boundaryRe), false);
    }
    return t === null ? card : { ...card, t };
  });
}

export default async function handler(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return err('config', 'GEMINI_API_KEY не настроен на сервере', 500);
  if (req.method !== 'POST') return err('bad-request', 'Ожидается POST', 405);

  let payload;
  try { payload = await req.json(); } catch (e) { return err('bad-request', 'Неверный JSON'); }

  const mode = ['words', 'phrases', 'both'].includes(payload.mode) ? payload.mode : 'both';
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  const transcript = compactTranscript(segments);
  if (transcript.length < 40) return err('empty-transcript', 'Транскрипт пустой или слишком короткий');

  const prompt = buildPrompt({
    title: String(payload.title || '').slice(0, 200),
    lang: String(payload.lang || '').slice(0, 12),
    mode,
    transcript,
  });

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  let { status, body } = await callGemini(apiKey, model, prompt, true);
  if (status === 400) {
    // старые/другие модели могут не знать thinkingConfig — повторяем без него
    ({ status, body } = await callGemini(apiKey, model, prompt, false));
  }
  if (status === 429) return err('quota', 'Квота Gemini исчерпана — попробуй позже', 429);
  if (status !== 200) {
    return err('llm-failed', body?.error?.message || `Gemini вернул ошибку (${status})`, 502);
  }

  const text = body?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  let cards;
  try { cards = normalizeCards(JSON.parse(text)); } catch (e) {
    return err('llm-bad-json', 'Gemini вернул некорректный JSON — попробуй ещё раз', 502);
  }
  if (!cards.length) return err('no-cards', 'Не удалось выделить лексику из этого видео', 422);
  return json({ cards: resolveTimestamps(cards, segments) });
}

export const config = { path: '/api/yt-generate' };
