const STORAGE_KEY = 'kar_theme';
const THEME_COLORS = { light: '#F6F0E6', dark: '#1A1612' };

export function resolveTheme(stored) {
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function updateNativeStatusBar(theme) {
  // Нативный статус-бар iOS/Android через плагин Capacitor StatusBar.
  // На обычном вебе window.Capacitor нет — тихо выходим.
  const bar = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
  if (!bar) return;
  // Style.Dark = светлый текст (для тёмного фона); Style.Light = тёмный текст (для светлого).
  try { bar.setStyle({ style: theme === 'dark' ? 'DARK' : 'LIGHT' }); } catch (e) { /* игнор */ }
}

function updateThemeColor(theme) {
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLORS[theme];
}

export function applyTheme(theme, { animate = false } = {}) {
  document.documentElement.dataset.theme = theme;
  updateThemeColor(theme);
  updateNativeStatusBar(theme);
  if (animate) {
    document.documentElement.classList.add('theme-transition');
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 400);
  }
}

export function initTheme() {
  applyTheme(resolveTheme(localStorage.getItem(STORAGE_KEY)));
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme, { animate: true });
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
