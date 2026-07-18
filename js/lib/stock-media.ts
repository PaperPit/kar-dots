/** Поиск бесплатных стоковых картинок, GIF и стикеров. */

import { translateText } from "./translate.js"
import { withStockKeys, getPixabayApiKey, getGiphyApiKey } from "./stock-media-settings.js"
import { searchGiphy, searchPixabay } from "./stock-media-providers.js"
import type { Settings } from "../data/types.js"

const OPENVERSE = "https://api.openverse.org/v1/images/"
const WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php"

export interface StockItem {
  id: string
  title: string
  url: string
  thumb: string
  isGif: boolean
  attribution: string
  foreignLandingUrl: string
  creator: string
  source: "openverse" | "wikimedia" | string
  provider: string
}

interface WikimediaImageInfo {
  url?: string
  thumburl?: string
  mime?: string
}

interface StockSearchMeta {
  query: string
  original: string
  searchQuery: string
  translated: boolean
  enriched: boolean
  baseWord?: string
  provider: string
  error?: string
  fallback?: boolean
  needsKeys?: boolean
}

export interface StockSearchResult {
  total: number
  page: number
  pageCount: number
  items: StockItem[]
  searchMeta: StockSearchMeta
}

interface StockSearchParams {
  searchQuery: string
  type: string
  page: number
  pageSize: number
  settings?: Settings | null
}

interface StockRawResult {
  error?: string
  total: number
  page: number
  pageCount: number
  items: StockItem[]
  provider?: string
}

interface OpenverseHit {
  id?: string | number
  title?: string
  url?: string
  filetype?: string
  attribution?: string
  creator?: string
  provider?: string
  foreign_landing_url?: string
  [key: string]: unknown
}

interface OpenverseResponse {
  result_count?: number
  page?: number
  page_count?: number
  results?: OpenverseHit[]
  [key: string]: unknown
}

interface WikimediaPage {
  title?: string
  pageid?: string | number
  imageinfo?: WikimediaImageInfo[]
  [key: string]: unknown
}

interface WikimediaCommonsResponse {
  query?: { pages?: Record<string, WikimediaPage> }
  [key: string]: unknown
}

/** Однословные термины с «шумным» совпадением в подписях событий. */
const VOCAB_SEARCH_HINTS: Record<string, string> = {
  month: "calendar months of the year",
  week: "seven days week calendar",
  day: "calendar day daytime",
  year: "calendar year seasons",
  time: "clock time hour",
  date: "calendar date",
  wait: "person waiting",
  air: "sky air atmosphere",
  dark: "dark night shadow",
  light: "light bright lamp",
  spring: "spring season flowers nature",
  summer: "summer season sun",
  winter: "winter season snow",
  fall: "autumn fall leaves",
  autumn: "autumn fall leaves",
  bank: "river bank shore",
  race: "running race athletes",
  bat: "bat animal flying",
  watch: "wrist watch clock",
  match: "match fire stick",
  fair: "fair carnival festival",
  fine: "fine quality excellent",
  right: "right direction arrow",
  left: "left direction arrow",
  second: "second time clock",
  minute: "minute clock time",
  hour: "hour clock time"
}

const TIME_UNITS = new Set(["month", "week", "day", "year", "hour", "minute", "second"])

const TITLE_NOISE = [
  /\b(awareness|heritage|history|national|international)\s+\w*\s*month\b/i,
  /\bmonth\s+of\s+(the\s+)?(awareness|heritage|history)\b/i,
  /\b(domestic violence|black history|asian american|pacific islander)\b/i,
  /\blaunch(es|ed|ing)?\b/i,
  /\bcelebration\b/i,
  /\bminister\b/i,
  /\bofficially\b/i
]

export function hasCyrillic(text: string | null | undefined): boolean {
  return /[\u0400-\u04FF]/.test(String(text || ""))
}

export function isSingleVocabWord(text: string | null | undefined): boolean {
  const t = String(text || "").trim()
  return t.split(/\s+/).filter(Boolean).length === 1 && /^[\p{L}''-]+$/u.test(t)
}

/** Уточняет запрос для словарных слов — меньше «Heritage Month» и случайных событий. */
export function enrichVocabStockQuery(query: string | null | undefined): { searchQuery: string; enriched: boolean; baseWord: string } {
  const raw = String(query || "").trim()
  const lower = raw.toLowerCase()
  if (!raw) return { searchQuery: "", enriched: false, baseWord: "" }

  if (VOCAB_SEARCH_HINTS[lower]) {
    return { searchQuery: VOCAB_SEARCH_HINTS[lower], enriched: true, baseWord: lower }
  }

  if (isSingleVocabWord(raw) && TIME_UNITS.has(lower)) {
    const searchQuery = `${lower} calendar time`
    return { searchQuery, enriched: true, baseWord: lower }
  }

  return { searchQuery: raw, enriched: false, baseWord: lower }
}

export function scoreStockRelevance(item: StockItem, baseWord: string | null | undefined): number {
  const word = String(baseWord || "")
    .trim()
    .toLowerCase()
  if (!word) return 0
  const title = String(item.title || "").toLowerCase()
  let score = 0

  if (new RegExp(`\\b${word}s?\\b`, "i").test(title)) score += 2
  if (title.includes(word)) score += 1

  for (const re of TITLE_NOISE) {
    if (re.test(title) && word.length <= 7) score -= 5
  }

  if (word === "month" && /\bcalendar|months|january|february|march|april|twelve\b/i.test(title)) {
    score += 6
  }
  if (word === "week" && /\bcalendar|monday|seven days\b/i.test(title)) score += 5
  if (word === "day" && /\bcalendar|sun(day)?|daytime\b/i.test(title)) score += 4

  if (item.source === "wikimedia") score += 3
  if (item.source === "openverse" && item.provider === "wikimedia") score += 2

  return score
}

export function rankStockResults(items: StockItem[], baseWord: string | null | undefined): StockItem[] {
  return [...items].sort((a, b) => {
    const diff = scoreStockRelevance(b, baseWord) - scoreStockRelevance(a, baseWord)
    if (diff !== 0) return diff
    return String(a.title || "").localeCompare(String(b.title || ""), "ru")
  })
}

/** Wikimedia: Openverse /thumb/ часто 424 — собираем рабочий preview. */
export function wikimediaThumbUrl(fullUrl: string, width = 320): string | null {
  try {
    const u = new URL(fullUrl)
    if (!u.hostname.includes("upload.wikimedia.org")) return null
    if (u.pathname.includes("/thumb/")) return fullUrl
    const parts = u.pathname.split("/").filter(Boolean)
    const commonsIdx = parts.indexOf("commons")
    if (commonsIdx < 0 || parts.length < commonsIdx + 4) return null
    const hash1 = parts[commonsIdx + 1]!
    const hash2 = parts[commonsIdx + 2]!
    const filename = parts.slice(commonsIdx + 3).join("/")
    const decoded = decodeURIComponent(filename)
    const encName = filename
      .split("/")
      .map((p) => encodeURIComponent(decodeURIComponent(p)))
      .join("/")
    return `${u.origin}/wikipedia/commons/thumb/${hash1}/${hash2}/${encName}/${width}px-${decoded}`
  } catch {
    return null
  }
}

export function pickStockThumb(row: StockItem): string {
  const url = String(row?.url || "")
  const wiki = wikimediaThumbUrl(url)
  if (wiki) return wiki
  return String((row as { thumbnail?: string }).thumbnail || url)
}

export function normalizeOpenverseHit(row: OpenverseHit): StockItem {
  const url = String(row?.url || "")
  const thumb = pickStockThumb(row as unknown as StockItem)
  const isGif = /\.gif(\?|$)/i.test(url) || String(row.filetype || "").toLowerCase() === "gif"
  return {
    id: String(row?.id || url),
    title: String(row?.title || "Без названия").trim(),
    url,
    thumb,
    isGif,
    attribution: String(row?.attribution || "").trim(),
    foreignLandingUrl: String(row.foreign_landing_url || "").trim(),
    creator: String(row?.creator || "").trim(),
    source: "openverse",
    provider: String(row?.provider || "")
  }
}

export function normalizeWikimediaHit(page: { title?: string; pageid?: string | number } | null | undefined, imageinfo: WikimediaImageInfo[] = []): StockItem {
  const ii = imageinfo[0] || {}
  const url = String(ii.url || "")
  const title =
    String(page?.title || "")
      .replace(/^File:/i, "")
      .trim() || "Wikimedia"
  const thumb = String(ii.thumburl || "") || wikimediaThumbUrl(url) || url
  const mime = String(ii.mime || "")
  const isGif = mime === "image/gif" || /\.gif(\?|$)/i.test(url)
  const pageTitle = String(page?.title || "")
  return {
    id: `wiki-${page?.pageid || url}`,
    title,
    url,
    thumb,
    isGif,
    attribution: `«${title}» — Wikimedia Commons (CC)`,
    foreignLandingUrl: pageTitle
      ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`
      : "",
    creator: "",
    source: "wikimedia",
    provider: "wikimedia"
  }
}

export async function resolveStockSearchQuery(q: string | null | undefined): Promise<{ query: string; original: string; translated: boolean }> {
  const original = String(q || "").trim()
  if (!original) return { query: "", original, translated: false }
  if (!hasCyrillic(original)) return { query: original, original, translated: false }
  try {
    const query = await translateText(original, "ru-en")
    return { query, original, translated: query.toLowerCase() !== original.toLowerCase() }
  } catch {
    return { query: original, original, translated: false }
  }
}

export function buildStockSearchUrl({ q, type = "photo", page = 1, pageSize = 20 }: { q?: string | null; type?: string; page?: number; pageSize?: number }): string {
  const params = new URLSearchParams({
    q: String(q || "").trim(),
    page: String(page),
    page_size: String(Math.min(Math.max(pageSize, 1), 30)),
    license_type: "commercial,modification"
  })
  if (type === "gif") params.set("extension", "gif")
  return `${OPENVERSE}?${params}`
}

async function searchOpenverse({ q, type, page, pageSize }: { q: string; type: string; page: number; pageSize: number }): Promise<StockRawResult> {
  const res = await fetch(buildStockSearchUrl({ q, type, page, pageSize }))
  if (res.status === 429) throw new Error("Слишком много запросов — подождите минуту")
  if (!res.ok) throw new Error("Поиск временно недоступен")
  const data: OpenverseResponse = await res.json()
  return {
    total: data.result_count || 0,
    page: data.page || page,
    pageCount: data.page_count || page,
    items: (data.results || []).map(normalizeOpenverseHit).filter((i: StockItem) => i.url && i.thumb)
  }
}

async function searchWikimediaCommons({ q, limit = 12 }: { q: string; limit?: number }): Promise<StockItem[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: q,
    gsrlimit: String(Math.min(limit, 20)),
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|thumburl|mime",
    iiurlwidth: "320"
  })
  const res = await fetch(`${WIKIMEDIA_API}?${params}`)
  if (!res.ok) return []
  const data: WikimediaCommonsResponse = await res.json()
  const pages = data?.query?.pages || {}
  return Object.values(pages)
    .map((p: WikimediaPage) => normalizeWikimediaHit(p, p.imageinfo))
    .filter((i: StockItem) => i.url && i.thumb && !i.isGif)
}

function dedupeStockItems(items: StockItem[]): StockItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = String(item.url).split("?")[0]!
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function searchStockMediaRemote({ searchQuery, type, page, pageSize, settings }: StockSearchParams): Promise<StockRawResult | null> {
  try {
    const res = await fetch("/api/stock-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        withStockKeys(settings || null, {
          q: searchQuery,
          type,
          page,
          pageSize
        })
      )
    })
    if (!res.ok) return null
    const data: StockRawResult = await res.json()
    if (data.error || data.provider === "none") return null
    return data
  } catch {
    return null
  }
}

async function searchStockMediaDirect({ searchQuery, type, page, pageSize, settings }: StockSearchParams): Promise<StockRawResult | null> {
  const pixabayKey = getPixabayApiKey(settings || null)
  const giphyKey = getGiphyApiKey(settings || null)

  if ((type === "photo" || type === "illustration") && pixabayKey) {
    return searchPixabay(pixabayKey, { q: searchQuery, type, page, pageSize })
  }
  if ((type === "gif" || type === "sticker") && giphyKey) {
    return searchGiphy(giphyKey, { q: searchQuery, type, page, pageSize })
  }
  return null
}

async function searchStockMediaProviders({ searchQuery, type, page, pageSize, settings }: StockSearchParams): Promise<StockRawResult | null> {
  const hasPixabay =
    (type === "photo" || type === "illustration") && getPixabayApiKey(settings || null)
  const hasGiphy = (type === "gif" || type === "sticker") && getGiphyApiKey(settings || null)

  if (hasPixabay || hasGiphy) {
    try {
      const remote = await searchStockMediaRemote({ searchQuery, type, page, pageSize, settings })
      if (remote) return remote
      return await searchStockMediaDirect({ searchQuery, type, page, pageSize, settings })
    } catch (e) {
      throw e
    }
  }

  const remote = await searchStockMediaRemote({ searchQuery, type, page, pageSize, settings })
  if (remote?.items?.length) return remote
  return null
}

function openverseTypeFor(type: string): string {
  if (type === "sticker" || type === "gif") return "gif"
  return "photo"
}

export interface SearchStockMediaOptions {
  q?: string | null
  type?: string
  page?: number
  pageSize?: number
  settings?: Settings | null
}

export async function searchStockMedia({
  q,
  type = "photo",
  page = 1,
  pageSize = 20,
  settings = null
}: SearchStockMediaOptions = {}): Promise<StockSearchResult> {
  const raw = String(q || "").trim()
  if (!raw) {
    return {
      total: 0,
      page: 1,
      pageCount: 0,
      items: [],
      searchMeta: {
        query: "",
        original: "",
        searchQuery: "",
        translated: false,
        enriched: false,
        provider: "none"
      }
    }
  }

  const { query, original, translated } = await resolveStockSearchQuery(raw)
  const { searchQuery, enriched, baseWord } = enrichVocabStockQuery(query)

  let providerResult: StockRawResult | null = null
  try {
    providerResult = await searchStockMediaProviders({
      searchQuery,
      type,
      page,
      pageSize,
      settings
    })
  } catch (e) {
    const err = e as Error
    return {
      total: 0,
      page: 1,
      pageCount: 0,
      items: [],
      searchMeta: {
        query,
        original,
        searchQuery,
        translated,
        enriched,
        baseWord,
        provider: "error",
        error: err.message
      }
    }
  }

  if (providerResult) {
    return {
      total: providerResult.total,
      page: providerResult.page,
      pageCount: providerResult.pageCount,
      items: providerResult.items,
      searchMeta: {
        query,
        original,
        searchQuery,
        translated,
        enriched,
        baseWord,
        provider: providerResult.provider || "provider"
      }
    }
  }

  const hasKeyForType =
    type === "gif" || type === "sticker"
      ? getGiphyApiKey(settings || null)
      : getPixabayApiKey(settings || null)

  const ovType = openverseTypeFor(type)
  const ov = await searchOpenverse({ q: searchQuery, type: ovType, page, pageSize })
  let items = ov.items

  if (ovType === "photo" && page === 1 && isSingleVocabWord(query)) {
    try {
      const wiki = await searchWikimediaCommons({ q: searchQuery, limit: 14 })
      items = dedupeStockItems([...wiki, ...items])
    } catch {
      /* optional */
    }
  }

  items = rankStockResults(items, baseWord || query.toLowerCase()).slice(0, pageSize)

  return {
    total: ov.total,
    page: ov.page,
    pageCount: ov.pageCount,
    items,
    searchMeta: {
      query,
      original,
      searchQuery,
      translated,
      enriched,
      baseWord,
      provider: "openverse",
      fallback: true,
      needsKeys: !hasKeyForType
    }
  }
}

export async function downloadStockMedia(item: StockItem): Promise<File> {
  const res = await fetch(item.url, { mode: "cors" })
  if (!res.ok) {
    throw new Error(
      "Не удалось скачать изображение (CORS). Попробуйте другое или загрузите файл вручную."
    )
  }
  const blob = await res.blob()
  const type = blob.type || (item.isGif ? "image/gif" : "image/jpeg")
  const ext = item.isGif ? "gif" : type.includes("png") ? "png" : "jpg"
  const safeId =
    String(item.id || "img")
      .replace(/[^\w-]+/g, "")
      .slice(0, 12) || "img"
  return new File([blob], `stock-${safeId}.${ext}`, { type })
}
