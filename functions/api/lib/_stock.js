// HTTP-слой для стоковых провайдеров (Pixabay / Giphy) на стороне Worker'а.
//
// Почему не зовём searchPixabay/searchGiphy из js/lib/stock-media-providers.js:
// там fetch без AbortSignal, а из Worker'а любой исходящий запрос обязан иметь
// таймаут, иначе висящий апстрим держит вызов до лимита платформы. Нормализацию
// ответа переиспользуем оттуда же — расходиться с браузерной версией нельзя.

import {
  normalizeGiphyHit,
  normalizePixabayHit,
} from '../../../js/lib/stock-media-providers.js';
import { isTimeoutError, logUpstream, timeoutMessage } from './_errors.js';

const STOCK_TIMEOUT_MS = 10000;
const MAX_PER_PAGE = 50;

function upstreamError(scope, provider, e) {
  logUpstream(scope, e);
  if (isTimeoutError(e)) {
    return Object.assign(new Error(scope), {
      code: 'timeout',
      message: timeoutMessage(provider),
      status: 504,
    });
  }
  return Object.assign(new Error(scope), {
    code: 'upstream',
    message: `${provider} недоступен — попробуй позже`,
    status: 502,
  });
}

async function getJson(url, scope, provider) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(STOCK_TIMEOUT_MS) });
  } catch (e) {
    throw upstreamError(scope, provider, e);
  }
  if (!res.ok) {
    logUpstream(scope, `HTTP ${res.status}`);
    throw Object.assign(new Error(scope), {
      code: 'upstream',
      message: `${provider} недоступен — попробуй позже`,
      status: 502,
    });
  }
  try {
    return await res.json();
  } catch (e) {
    throw upstreamError(scope, provider, e);
  }
}

export async function searchPixabay(key, { q, type = 'photo', page = 1, pageSize = 20 }) {
  const imageType = type === 'illustration' ? 'illustration' : 'photo';
  const perPage = Math.min(pageSize, MAX_PER_PAGE);
  const url = new URL('https://pixabay.com/api/');
  url.searchParams.set('key', key);
  url.searchParams.set('q', q);
  url.searchParams.set('image_type', imageType);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('lang', 'en');

  const data = await getJson(url, 'pixabay', 'Pixabay');
  if (data?.error) {
    logUpstream('pixabay', data.error);
    throw Object.assign(new Error('pixabay'), {
      code: 'upstream',
      message: 'Pixabay отклонил запрос — проверь ключ в Настройках',
      status: 502,
    });
  }
  const total = data?.totalHits || 0;
  return {
    items: (data?.hits || [])
      .map((h) => normalizePixabayHit(h, imageType))
      .filter((i) => i.url && i.thumb),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    provider: 'pixabay',
  };
}

export async function searchGiphy(key, { q, type = 'gif', page = 1, pageSize = 20 }) {
  const kind = type === 'sticker' ? 'sticker' : 'gif';
  const endpoint = kind === 'sticker' ? 'stickers' : 'gifs';
  const perPage = Math.min(pageSize, MAX_PER_PAGE);
  const url = new URL(`https://api.giphy.com/v1/${endpoint}/search`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(perPage));
  url.searchParams.set('offset', String((page - 1) * pageSize));
  url.searchParams.set('rating', 'g');
  url.searchParams.set('lang', 'en');

  const data = await getJson(url, 'giphy', 'Giphy');
  if (data?.meta?.status !== 200 && data?.meta?.msg) {
    logUpstream('giphy', data.meta.msg);
    throw Object.assign(new Error('giphy'), {
      code: 'upstream',
      message: 'Giphy отклонил запрос — проверь ключ в Настройках',
      status: 502,
    });
  }
  const total = data?.pagination?.total_count || 0;
  return {
    items: (data?.data || []).map((r) => normalizeGiphyHit(r, kind)).filter((i) => i.url && i.thumb),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    provider: 'giphy',
  };
}
