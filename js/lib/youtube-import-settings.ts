/**
 * Личные API-ключи для «Карточки из YouTube» (Настройки → Карточки из YouTube).
 * Supadata — обязателен для транскрипта; Gemini/Groq — для генерации карточек
 * (личный ключ приоритетнее серверного из env Netlify).
 */

import { cleanGeminiApiKey, cleanGroqApiKey, cleanSupadataApiKey } from "./llm-api-keys.js"
import type { Settings } from "../data/types.js"

export function getSupadataApiKey(settings: Settings | null | undefined): string {
  return cleanSupadataApiKey(settings?.supadataApiKey || "")
}

export function hasSupadataApiKey(settings: Settings | null | undefined): boolean {
  return getSupadataApiKey(settings).length > 0
}

export function getGeminiApiKey(settings: Settings | null | undefined): string {
  return cleanGeminiApiKey(settings?.geminiApiKey || "")
}

export function hasGeminiApiKey(settings: Settings | null | undefined): boolean {
  return getGeminiApiKey(settings).length > 0
}

export function getGroqApiKey(settings: Settings | null | undefined): string {
  return cleanGroqApiKey(settings?.groqApiKey || "")
}

export function hasGroqApiKey(settings: Settings | null | undefined): boolean {
  return getGroqApiKey(settings).length > 0
}

/** Добавляет к телу запроса /api/* личные ключи — только те, что заданы. */
export function withApiKeys(settings: Settings | null | undefined, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }
  const supadata = getSupadataApiKey(settings)
  if (supadata) out.supadataApiKey = supadata
  const gemini = getGeminiApiKey(settings)
  if (gemini) out.geminiApiKey = gemini
  const groq = getGroqApiKey(settings)
  if (groq) out.groqApiKey = groq
  return out
}

/** Краткий статус ключей для строки в настройках. */
export function integrationsKeySummary(settings: Settings | null | undefined): string {
  const parts = [
    hasSupadataApiKey(settings) ? "Supadata ✓" : "Supadata —",
    hasGeminiApiKey(settings) ? "Gemini ✓" : "Gemini —",
    hasGroqApiKey(settings) ? "Groq ✓" : "Groq —"
  ]
  return parts.join(" · ")
}
