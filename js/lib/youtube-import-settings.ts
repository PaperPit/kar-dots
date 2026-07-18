/**
 * Личные API-ключи для «Карточки из YouTube» (Настройки → Карточки из YouTube).
 * Supadata — обязателен для транскрипта; Gemini/Groq — для генерации карточек
 * (личный ключ приоритетнее серверного из env Netlify).
 */

import { cleanGeminiApiKey, cleanGroqApiKey, cleanSupadataApiKey } from './llm-api-keys.js';

export function getSupadataApiKey(settings) {
  return cleanSupadataApiKey(settings?.supadataApiKey || '');
}

export function hasSupadataApiKey(settings) {
  return getSupadataApiKey(settings).length > 0;
}

export function getGeminiApiKey(settings) {
  return cleanGeminiApiKey(settings?.geminiApiKey || '');
}

export function hasGeminiApiKey(settings) {
  return getGeminiApiKey(settings).length > 0;
}

export function getGroqApiKey(settings) {
  return cleanGroqApiKey(settings?.groqApiKey || '');
}

export function hasGroqApiKey(settings) {
  return getGroqApiKey(settings).length > 0;
}

/** Добавляет к телу запроса /api/* личные ключи — только те, что заданы. */
export function withApiKeys(settings, body) {
  const out = { ...body };
  const supadata = getSupadataApiKey(settings);
  if (supadata) out.supadataApiKey = supadata;
  const gemini = getGeminiApiKey(settings);
  if (gemini) out.geminiApiKey = gemini;
  const groq = getGroqApiKey(settings);
  if (groq) out.groqApiKey = groq;
  return out;
}

/** Краткий статус ключей для строки в настройках. */
export function integrationsKeySummary(settings) {
  const parts = [
    hasSupadataApiKey(settings) ? 'Supadata ✓' : 'Supadata —',
    hasGeminiApiKey(settings) ? 'Gemini ✓' : 'Gemini —',
    hasGroqApiKey(settings) ? 'Groq ✓' : 'Groq —',
  ];
  return parts.join(' · ');
}
