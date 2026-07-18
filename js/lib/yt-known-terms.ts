// Кэш известных терминов для YouTube-импорта (паки + YouTube-карточки в папках).

import { fetchPackManifest, isVocabPackFolder } from './vocab-packs.js';
import { collectKnownTerms, isYoutubeCard } from './youtube-import.js';
import {
  PACKS_KEY, getKnownTermsSlice, putKnownTermsSlice,
  folderSliceKey, clearKnownTermsFolderSlices, clearKnownTermsCardSlices,
} from './yt-known-terms-idb.js';

let generation = 0;
let sessionCache = null;
const packCardsCache = new Map();

/** folderId — точечный сброс IDB; без аргумента / null — все папки. */
export function bumpKnownTermsCache(folderId) {
  generation++;
  sessionCache = null;
  if (folderId) clearKnownTermsFolderSlices(folderId);
  else clearKnownTermsCardSlices();
}

async function loadPackCards(file) {
  if (packCardsCache.has(file)) return packCardsCache.get(file);
  const res = await fetch('packs/' + file);
  if (!res.ok) throw new Error('pack unavailable');
  const cards = (await res.json()).cards || [];
  packCardsCache.set(file, cards);
  return cards;
}

async function loadPackSources() {
  const cached = await getKnownTermsSlice(PACKS_KEY);
  if (cached?.mini?.length) return cached.mini;

  const sources = [];
  try {
    const manifest = await fetchPackManifest();
    for (const meta of manifest.packs || []) {
      try {
        sources.push(await loadPackCards(meta.file));
      } catch { /* pack unavailable */ }
    }
  } catch { /* manifest unavailable */ }

  if (sources.length) {
    await putKnownTermsSlice(PACKS_KEY, { mini: sources });
  }
  return sources;
}

async function folderMiniCards(store, folderId, youtubeOnly) {
  const key = folderSliceKey(folderId, youtubeOnly);
  const n = await store.countCards(folderId);
  const cached = await getKnownTermsSlice(key);
  if (cached && cached.n === n) return cached.mini;

  let mini;
  if (typeof store.scanFolderFronts === 'function') {
    mini = await store.scanFolderFronts(folderId, { youtubeOnly });
  } else {
    const cards = await store.getFolderCards(folderId);
    mini = youtubeOnly ? cards.filter(isYoutubeCard) : cards;
    mini = mini.filter(c => c.front).map(c => ({ front: c.front }));
  }

  await putKnownTermsSlice(key, { n, mini });
  return mini;
}

export async function loadKnownTermsForImport(store, folderId) {
  const key = `${generation}:${folderId}`;
  if (sessionCache?.key === key) return sessionCache.terms;

  const sources = await loadPackSources();

  for (const f of store.folders) {
    if (isVocabPackFolder(f)) continue;
    try {
      sources.push(await folderMiniCards(store, f.id, f.id !== folderId));
    } catch { /* folder unread */ }
  }

  const terms = collectKnownTerms(sources);
  sessionCache = { key, terms };
  return terms;
}
