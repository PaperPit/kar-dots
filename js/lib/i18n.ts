import { ru, type MessageValue, type PluralForms } from "./locales/ru.js"
import { en } from "./locales/en.js"

export type AppLocale = "ru" | "en"
export type { MessageValue, PluralForms }

let locale: AppLocale = "ru"

export function normalizeLocale(raw: string | null | undefined): AppLocale {
  const s = String(raw || "")
    .toLowerCase()
    .trim()
  if (s.startsWith("en")) return "en"
  return "ru"
}

export function setLocale(lang: string | null | undefined): AppLocale {
  locale = normalizeLocale(lang)
  return locale
}

export function getLocale(): AppLocale {
  return locale
}

/** BCP 47 tag for Date / Intl. */
export function localeTag(): string {
  return locale === "en" ? "en-US" : "ru-RU"
}

export function applyDocumentLang(): void {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = locale
  }
}

/** Apply UI locale from settings (or string) and sync <html lang>. */
export function applyUiLocale(lang: string | null | undefined): AppLocale {
  setLocale(lang)
  applyDocumentLang()
  return locale
}

function catalogFor(lang: AppLocale): Record<string, MessageValue> {
  return lang === "en" ? en : (ru as Record<string, MessageValue>)
}

function lookup(key: string): MessageValue | undefined {
  const active = catalogFor(locale)
  if (Object.prototype.hasOwnProperty.call(active, key)) return active[key]
  const fallback = ru as Record<string, MessageValue>
  if (Object.prototype.hasOwnProperty.call(fallback, key)) return fallback[key]
  return undefined
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] != null ? String(params[name]) : match
  )
}

function warnMissing(key: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[i18n] missing key: ${key}`)
  }
}

export function hasKey(key: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(ru, key) ||
    Object.prototype.hasOwnProperty.call(en, key)
  )
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const val = lookup(key)
  if (val == null) {
    warnMissing(key)
    return key
  }
  if (typeof val !== "string") {
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn(`[i18n] key "${key}" is plural; use tp()`)
    }
    return key
  }
  return interpolate(val, params)
}

function pickPlural(forms: PluralForms, n: number): string {
  const abs = Math.abs(Number(n)) || 0
  if (locale === "en") {
    if (abs === 1) return forms.one
    return forms.other ?? forms.many ?? forms.few ?? forms.one
  }
  // Russian: one / few / many
  if (abs % 10 === 1 && abs % 100 !== 11) return forms.one
  if (
    [2, 3, 4].includes(abs % 10) &&
    ![12, 13, 14].includes(abs % 100)
  ) {
    return forms.few ?? forms.many ?? forms.other ?? forms.one
  }
  return forms.many ?? forms.other ?? forms.few ?? forms.one
}

export function tp(
  key: string,
  n: number,
  params?: Record<string, string | number>
): string {
  const val = lookup(key)
  if (val == null) {
    warnMissing(key)
    return key
  }
  const merged = { n, ...params }
  if (typeof val === "string") return interpolate(val, merged)
  return interpolate(pickPlural(val, n), merged)
}
