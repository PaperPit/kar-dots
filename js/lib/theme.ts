const STORAGE_KEY = "kar_theme"
const THEME_COLORS: Record<"light" | "dark", string> = { light: "#F6F0E6", dark: "#1A1612" }

export type ThemeName = "light" | "dark"

export function resolveTheme(stored: string | null): ThemeName {
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function getTheme(): ThemeName {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}

function updateNativeStatusBar(theme: ThemeName): void {
  // Нативный статус-бар iOS/Android через плагин Capacitor StatusBar.
  // На обычном вебе window.Capacitor нет — тихо выходим.
  const bar =
    window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar
  if (!bar) return
  // Style.Dark = светлый текст (для тёмного фона); Style.Light = тёмный текст (для светлого).
  try {
    bar.setStyle({ style: theme === "dark" ? "DARK" : "LIGHT" })
  } catch (e) {
    /* игнор */
  }
}

function updateThemeColor(theme: ThemeName): void {
  let meta: HTMLMetaElement | null = document.querySelector(
    'meta[name="theme-color"]:not([media])'
  ) as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement("meta")
    meta.name = "theme-color"
    document.head.appendChild(meta)
  }
  meta.content = THEME_COLORS[theme]
}

export function applyTheme(theme: ThemeName, { animate = false }: { animate?: boolean } = {}): void {
  document.documentElement.dataset.theme = theme
  updateThemeColor(theme)
  updateNativeStatusBar(theme)
  if (animate) {
    document.documentElement.classList.add("theme-transition")
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition")
    }, 400)
  }
}

export function initTheme(): void {
  applyTheme(resolveTheme(localStorage.getItem(STORAGE_KEY)))
}

export function setTheme(theme: ThemeName): void {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme, { animate: true })
}

export function toggleTheme(): ThemeName {
  const next: ThemeName = getTheme() === "dark" ? "light" : "dark"
  setTheme(next)
  return next
}
