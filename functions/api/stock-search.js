// Cloudflare Pages Function: поиск стоковых фото/GIF.
// POST { q, type, page, pageSize, pixabayApiKey?, giphyApiKey? }

import { searchGiphy, searchPixabay } from '../../js/lib/stock-media-providers.js';

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

async function handler(req, env) {
  if (req.method !== 'POST') return json({ error: 'bad-request', message: 'Ожидается POST' }, 405);

  let payload;
  try { payload = await req.json(); } catch {
    return json({ error: 'bad-request', message: 'Неверный JSON' }, 400);
  }

  const q = String(payload.q || '').trim();
  if (!q) return json({ error: 'bad-request', message: 'Пустой запрос' }, 400);

  const type = String(payload.type || 'photo');
  const page = Math.max(1, Number(payload.page) || 1);
  const pageSize = Math.min(30, Math.max(1, Number(payload.pageSize) || 20));

  const pixabayKey = cleanPixabay(payload.pixabayApiKey) || cleanPixabay(env?.PIXABAY_API_KEY);
  const giphyKey = cleanGiphy(payload.giphyApiKey) || cleanGiphy(env?.GIPHY_API_KEY);

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
    return json({ error: 'upstream', message: String(e.message || e) }, 502);
  }
}

export const onRequestPost = (ctx) => handler(ctx.request, ctx.env);
