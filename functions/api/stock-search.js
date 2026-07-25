// Cloudflare Pages Function: поиск стоковых фото/GIF.
// POST { q, type, page, pageSize, pixabayApiKey?, giphyApiKey? }

import { searchGiphy, searchPixabay } from '../../js/lib/stock-media-providers.js';
import { cleanGiphyApiKey, cleanPixabayApiKey } from './lib/api-keys.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function handler(req, _env) {
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

  // Только ключи из запроса — серверные PIXABAY_/GIPHY_ не используем.
  const pixabayKey = cleanPixabayApiKey(payload.pixabayApiKey);
  const giphyKey = cleanGiphyApiKey(payload.giphyApiKey);

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
