import { cleanGiphyApiKey, cleanPixabayApiKey } from "./llm-api-keys.js"
import type { Settings } from "../data/types.js"

export function getPixabayApiKey(settings: Settings | null | undefined): string {
  return cleanPixabayApiKey(settings?.pixabayApiKey || "")
}

export function getGiphyApiKey(settings: Settings | null | undefined): string {
  return cleanGiphyApiKey(settings?.giphyApiKey || "")
}

export function hasPixabayApiKey(settings: Settings | null | undefined): boolean {
  return getPixabayApiKey(settings).length > 0
}

export function hasGiphyApiKey(settings: Settings | null | undefined): boolean {
  return getGiphyApiKey(settings).length > 0
}

export function withStockKeys(settings: Settings | null | undefined, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }
  const pixabay = getPixabayApiKey(settings)
  if (pixabay) out.pixabayApiKey = pixabay
  const giphy = getGiphyApiKey(settings)
  if (giphy) out.giphyApiKey = giphy
  return out
}

export function stockMediaKeySummary(settings: Settings | null | undefined): string {
  const parts = [
    hasPixabayApiKey(settings) ? "Pixabay ✓" : "Pixabay —",
    hasGiphyApiKey(settings) ? "Giphy ✓" : "Giphy —"
  ]
  return parts.join(" · ")
}

/** Есть ли ключ для выбранного типа медиа. */
export function hasStockProviderForType(settings: Settings | null | undefined, type: string): boolean {
  if (type === "sticker" || type === "gif") return hasGiphyApiKey(settings)
  if (type === "photo" || type === "illustration") return hasPixabayApiKey(settings)
  return false
}
