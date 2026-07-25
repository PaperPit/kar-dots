import { stripHtml } from '../ui/ui.js'

export type CardSearchFields = {
  id?: string
  front?: string
  back?: string
  description?: string
}

export type CardSearchEntry = {
  hay: string
  frontPlain: string
  backPlain: string
}

/** One DOMParser pass per field when building the folder search index. */
export function cardSearchEntry(card: CardSearchFields): CardSearchEntry {
  const frontPlain = stripHtml(card.front || '')
  const backPlain = stripHtml(card.back || '')
  const descPlain = stripHtml(card.description || '')
  const hay = [frontPlain, backPlain, descPlain]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return { hay, frontPlain, backPlain }
}

export function cardSearchText(card: CardSearchFields): string {
  return cardSearchEntry(card).hay
}

/** Build search haystack + display plains in one pass per card. */
export function buildCardSearchIndex(cards: CardSearchFields[]): {
  hay: Map<string, string>
  plains: Map<string, { front: string; back: string }>
} {
  const hay = new Map<string, string>()
  const plains = new Map<string, { front: string; back: string }>()
  for (const c of cards) {
    const id = c.id || ''
    const e = cardSearchEntry(c)
    hay.set(id, e.hay)
    plains.set(id, { front: e.frontPlain, back: e.backPlain })
  }
  return { hay, plains }
}

export function matchesSearchIndex(
  index: Map<string, string>,
  cardId: string | undefined,
  query: string,
): boolean {
  if (!query) return true
  const h = index.get(cardId || '') || ''
  return h.includes(query.toLowerCase())
}
