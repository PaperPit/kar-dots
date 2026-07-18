import { bumpKnownTermsCache } from "../lib/yt-known-terms.js"

interface InvalidateOpts {
  allFolders?: boolean
  folderId?: string
}

export interface InvalidatableStore {
  _invalidateHomeStats?: () => void
}

export function invalidateDerivedCaches(
  store: InvalidatableStore | null | undefined,
  opts: InvalidateOpts = {}
) {
  if (store?._invalidateHomeStats) store._invalidateHomeStats()
  if (opts.allFolders) bumpKnownTermsCache(null)
  else bumpKnownTermsCache(opts.folderId ?? null)
}
