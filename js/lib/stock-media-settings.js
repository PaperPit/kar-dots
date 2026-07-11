import { cleanGiphyApiKey, cleanPixabayApiKey } from './llm-api-keys.js';

export function getPixabayApiKey(settings) {
  return cleanPixabayApiKey(settings?.pixabayApiKey || '');
}

export function getGiphyApiKey(settings) {
  return cleanGiphyApiKey(settings?.giphyApiKey || '');
}

export function hasPixabayApiKey(settings) {
  return getPixabayApiKey(settings).length > 0;
}

export function hasGiphyApiKey(settings) {
  return getGiphyApiKey(settings).length > 0;
}

export function withStockKeys(settings, body) {
  const out = { ...body };
  const pixabay = getPixabayApiKey(settings);
  if (pixabay) out.pixabayApiKey = pixabay;
  const giphy = getGiphyApiKey(settings);
  if (giphy) out.giphyApiKey = giphy;
  return out;
}

export function stockMediaKeySummary(settings) {
  const parts = [
    hasPixabayApiKey(settings) ? 'Pixabay ✓' : 'Pixabay —',
    hasGiphyApiKey(settings) ? 'Giphy ✓' : 'Giphy —',
  ];
  return parts.join(' · ');
}

/** Есть ли ключ для выбранного типа медиа. */
export function hasStockProviderForType(settings, type) {
  if (type === 'sticker' || type === 'gif') return hasGiphyApiKey(settings);
  if (type === 'photo' || type === 'illustration') return hasPixabayApiKey(settings);
  return false;
}
