const loaded = new Map<string, Promise<void>>()

/** Inject a stylesheet once; resolves when loaded (or immediately if already present). */
export function ensureCss(href: string): Promise<void> {
  const existing = loaded.get(href)
  if (existing) return existing

  const abs = new URL(href, document.baseURI).href
  const already = [...document.querySelectorAll('link[rel="stylesheet"]')].some(
    (l) => (l as HTMLLinkElement).href === abs || (l as HTMLLinkElement).getAttribute('href') === href,
  )
  if (already) {
    const done = Promise.resolve()
    loaded.set(href, done)
    return done
  }

  const p = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => reject(new Error('Failed to load CSS: ' + href))
    document.head.appendChild(link)
  }).catch((err) => {
    console.warn(err)
  }) as Promise<void>

  loaded.set(href, p)
  return p
}

export const SCREEN_CSS = {
  folder: 'css/screens/folder.css',
  review: 'css/screens/review.css',
  settings: 'css/screens/settings.css',
  stats: 'css/screens/stats.css',
  cardEditor: 'css/screens/card-editor.css',
  youtubeImport: 'css/screens/youtube-import.css',
} as const
