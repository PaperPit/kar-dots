/**
 * Minimal i18n for the Chrome extension (RU/EN).
 * Locale: chrome.i18n UI language → navigator.language → ru.
 */
export type ExtLocale = "ru" | "en"

const ru: Record<string, string> = {
  "brand.title": "КАР-точки",
  "brand.sub": "Карточки из YouTube",
  "fatal.title": "Окно не смогло запуститься: {message}",
  "fatal.hint":
    "Если это повторяется — правый клик по окну → «Просмотреть код» и пришли текст из вкладки Console.",
  "fatal.retry": "Попробовать снова",
  "account.localOnly": "Без облака — экспорт JSON",
  "account.openApp": "Открыть КАР-точки",
  "mode.words": "Слова",
  "mode.phrases": "Фразы",
  "mode.both": "Слова + фразы",
  "mode.sentences": "Предложения",
  "form.mergeCues": "Склеивать короткие реплики в предложения",
  "form.noFolders": "Нет папок — создай в приложении",
  "form.generate": "Сформировать",
  "form.videoFallback": "Текущее видео",
  "form.urlFallback": "Открой ролик на YouTube",
  "form.whatLabel": "Что достать из ролика",
  "form.folderLabel": "Имя папки в экспорте",
  "form.keysLabel": "API-ключи (Supadata / Gemini / Groq)",
  "form.exportHint": "Карточки скачаются JSON-файлом — импортируй в Настройках приложения.",
  "form.badUrl": "Не похоже на ссылку на YouTube-видео — открой ролик на YouTube",
  "form.needSupadata": "Укажи Supadata API ключ в полях выше",
  "form.needLlm": "Укажи Gemini или Groq API ключ в полях выше",
  "form.empty": "Карточек не нашлось",
  "progress.cancel": "Отмена",
  "progress.fetchVideo": "Получаю данные видео…",
  "progress.generate": "Составляю карточки…",
  "progress.checkSentences": "Проверяю новые предложения…",
  "progress.checkWords": "Проверяю новые слова…",
  "preview.selected": "Выбрано: {n}",
  "preview.title": "Превью",
  "preview.hint": "Отметь, что сохранить, при необходимости поправь перевод",
  "preview.create": "Скачать JSON",
  "preview.back": "Назад",
  "preview.group.words": "Слова",
  "preview.group.phrases": "Фразы",
  "preview.group.sentences": "Предложения",
  "save.exported": "Скачано карточек: {ok}",
  "save.openImport": "Открыть настройки для импорта",
  "error.generic": "ошибка",
}

const en: Record<string, string> = {
  "brand.title": "KAR-dots",
  "brand.sub": "Cards from YouTube",
  "fatal.title": "The panel failed to start: {message}",
  "fatal.hint":
    "If this keeps happening — right-click the panel → Inspect and send the Console text.",
  "fatal.retry": "Try again",
  "account.localOnly": "No cloud — JSON export",
  "account.openApp": "Open KAR-dots",
  "mode.words": "Words",
  "mode.phrases": "Phrases",
  "mode.both": "Words + phrases",
  "mode.sentences": "Sentences",
  "form.mergeCues": "Merge short cues into sentences",
  "form.noFolders": "No folders — create one in the app",
  "form.generate": "Generate",
  "form.videoFallback": "Current video",
  "form.urlFallback": "Open a YouTube video",
  "form.whatLabel": "What to extract",
  "form.folderLabel": "Folder name in export",
  "form.keysLabel": "API keys (Supadata / Gemini / Groq)",
  "form.exportHint": "Cards download as JSON — import them in the app Settings.",
  "form.badUrl": "That doesn’t look like a YouTube video URL — open a video on YouTube",
  "form.needSupadata": "Add a Supadata API key in the fields above",
  "form.needLlm": "Add a Gemini or Groq API key in the fields above",
  "form.empty": "No cards found",
  "progress.cancel": "Cancel",
  "progress.fetchVideo": "Fetching video…",
  "progress.generate": "Building cards…",
  "progress.checkSentences": "Checking new sentences…",
  "progress.checkWords": "Checking new words…",
  "preview.selected": "Selected: {n}",
  "preview.title": "Preview",
  "preview.hint": "Tick what to keep; edit the translation if needed",
  "preview.create": "Download JSON",
  "preview.back": "Back",
  "preview.group.words": "Words",
  "preview.group.phrases": "Phrases",
  "preview.group.sentences": "Sentences",
  "save.exported": "Downloaded cards: {ok}",
  "save.openImport": "Open settings to import",
  "error.generic": "error",
}

const catalogs: Record<ExtLocale, Record<string, string>> = { ru, en }
let locale: ExtLocale = "ru"

export function detectExtLocale(): ExtLocale {
  try {
    const ui =
      typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
        ? chrome.i18n.getUILanguage()
        : typeof navigator !== "undefined"
          ? navigator.language
          : "ru"
    return String(ui || "ru").toLowerCase().startsWith("en") ? "en" : "ru"
  } catch {
    return "ru"
  }
}

export function setExtLocale(next: ExtLocale): void {
  locale = next
}

export function getExtLocale(): ExtLocale {
  return locale
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const catalog = catalogs[locale] || ru
  let s = catalog[key] ?? ru[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}

/** Mode button labels for the current locale. */
export function modeLabel(id: string): string {
  const map: Record<string, string> = {
    words: "mode.words",
    phrases: "mode.phrases",
    both: "mode.both",
    sentences: "mode.sentences",
  }
  return t(map[id] || id)
}

export const EXT_I18N_KEYS = Object.keys(ru)
