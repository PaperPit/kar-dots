import { bumpKnownTermsCache } from '../lib/yt-known-terms.js';

export function invalidateDerivedCaches(store, opts = {}) {
  if (store?._invalidateHomeStats) store._invalidateHomeStats();
  if (opts.allFolders) bumpKnownTermsCache(null);
  else bumpKnownTermsCache(opts.folderId);
}
