// Cloudflare Pages Function: поиск стоковых фото/GIF.
// POST { q, type, page, pageSize, pixabayApiKey?, giphyApiKey? }
//
// Личность вызывающего (subject) и лимиты — в functions/api/_middleware.js.
// Запросы к провайдерам идут через ./lib/_stock.js: там есть таймауты, а текст
// ошибки апстрима наружу не отдаётся (уходит в console.error).

import { searchGiphy, searchPixabay } from './lib/_stock.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanPixabay(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[0-9]+-[A-Za-z0-9_-]{10,128}$/.test(s)) return s;
  if (s.length >= 20 && s.includes('-')) return s;
  return '';
}

function cleanGiphy(raw) {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9]{16,128}$/.test(s) ? s : '';
}

async function handler(req, _env, subject = '') {
  if (req.method !== 'POST') return json({ error: 'bad-request', message: 'Ожидается POST' }, 405);

  let payload;
  try { payload = await req.json(); } catch {
    return json({ error: 'bad-request', message: 'Неверный JSON' }, 400);
  }

  const q = String(payload.q || '').trim().slice(0, 200);
  if (!q) return json({ error: 'bad-request', message: 'Пустой запрос' }, 400);

  const type = String(payload.type || 'photo');
  const page = Math.max(1, Number(payload.page) || 1);
  const pageSize = Math.min(30, Math.max(1, Number(payload.pageSize) || 20));

  // Только ключи из запроса — серверные PIXABAY_/GIPHY_ не используем.
  const pixabayKey = cleanPixabay(payload.pixabayApiKey);
  const giphyKey = cleanGiphy(payload.giphyApiKey);

  try {
    if ((type === 'photo' || type === 'illustration') && pixabayKey) {
      return json(await searchPixabay(pixabayKey, { q, type, page, pageSize }));
    }
    if ((type === 'gif' || type === 'sticker') && giphyKey) {
      return json(await searchGiphy(giphyKey, { q, type, page, pageSize }));
    }
    return json({
      items: [],
      total: 0,
      page: 1,
      pageCount: 0,
      provider: 'none',
      needsKeys: true,
    });
  } catch (e) {
    // e.message здесь уже наш русский текст (см. lib/_stock.js); сырой ответ
    // провайдера туда не попадает — он ушёл в console.error.
    if (e?.code) return json({ error: e.code, message: e.message }, e.status || 502);
    console.error('[stock-search] неожиданная ошибка', String(e?.message || e), { subject });
    return json({ error: 'upstream', message: 'Поиск временно недоступен — попробуй позже' }, 502);
  }
}

export const onRequestPost = (ctx) => handler(ctx.request, ctx.env, ctx?.data?.subject || '');
