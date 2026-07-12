/** Pixabay + Giphy — общая логика для сервера и браузера. */

export function normalizePixabayHit(hit, imageType = 'photo') {
  const url = hit.largeImageURL || hit.webformatURL || hit.previewURL || '';
  const thumb = hit.previewURL || hit.webformatURL || url;
  return {
    id: `px-${hit.id}`,
    title: String(hit.tags || 'Pixabay').split(',')[0].trim() || 'Pixabay',
    url,
    thumb,
    isGif: false,
    isSticker: false,
    attribution: `Pixabay · ${hit.user || 'author'} (Pixabay License)`,
    foreignLandingUrl: hit.pageURL || 'https://pixabay.com',
    creator: String(hit.user || ''),
    source: 'pixabay',
    provider: 'pixabay',
    mediaType: imageType,
  };
}

export function normalizeGiphyHit(row, kind = 'gif') {
  const images = row.images || {};
  const url = images.original?.url || images.downsized_medium?.url || images.fixed_height?.url || '';
  const thumb = images.fixed_height_downsampled?.url
    || images.preview_gif?.url
    || images.fixed_width_small?.url
    || url;
  const isGif = kind === 'gif' || /\.gif(\?|$)/i.test(url);
  return {
    id: `giphy-${row.id}`,
    title: String(row.title || row.slug || 'Giphy').trim(),
    url,
    thumb,
    isGif,
    isSticker: kind === 'sticker',
    attribution: `Giphy · ${row.username || 'author'}`,
    foreignLandingUrl: row.url || 'https://giphy.com',
    creator: String(row.username || ''),
    source: 'giphy',
    provider: 'giphy',
    mediaType: kind,
  };
}

export async function searchPixabay(key, { q, type = 'photo', page = 1, pageSize = 20 }) {
  const imageType = type === 'illustration' ? 'illustration' : 'photo';
  const url = new URL('https://pixabay.com/api/');
  url.searchParams.set('key', key);
  url.searchParams.set('q', q);
  url.searchParams.set('image_type', imageType);
  url.searchParams.set('per_page', String(Math.min(pageSize, 50)));
  url.searchParams.set('page', String(page));
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('lang', 'en');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Pixabay недоступен');
  const data = await res.json();
  if (data.error) throw new Error(String(data.error));
  const total = data.totalHits || 0;
  const perPage = Math.min(pageSize, 50);
  return {
    items: (data.hits || []).map(h => normalizePixabayHit(h, imageType)).filter(i => i.url && i.thumb),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    provider: 'pixabay',
  };
}

export async function searchGiphy(key, { q, type = 'gif', page = 1, pageSize = 20 }) {
  const kind = type === 'sticker' ? 'sticker' : 'gif';
  const endpoint = kind === 'sticker' ? 'stickers' : 'gifs';
  const offset = (page - 1) * pageSize;
  const url = new URL(`https://api.giphy.com/v1/${endpoint}/search`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(Math.min(pageSize, 50)));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('rating', 'g');
  url.searchParams.set('lang', 'en');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Giphy недоступен');
  const data = await res.json();
  if (data.meta?.status !== 200 && data.meta?.msg) throw new Error(data.meta.msg);
  const total = data.pagination?.total_count || 0;
  const perPage = Math.min(pageSize, 50);
  return {
    items: (data.data || []).map(r => normalizeGiphyHit(r, kind)).filter(i => i.url && i.thumb),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    provider: 'giphy',
  };
}
