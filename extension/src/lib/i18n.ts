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
  "auth.body":
    "Чтобы сохранять карточки в свою коллекцию, подключи аккаунт на {host}.",
  "auth.login": "Войти через КАР-точки",
  "auth.hint":
    "Откроется сайт — войди, если ещё не вошёл. Расширение получит сессию автоматически.",
  "auth.expired": "Сессия истекла — подключите аккаунт снова",
  "account.connected": "Аккаунт подключён",
  "account.email": "Аккаунт: {email}",
  "account.disconnect": "Отключить",
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
  "form.folderLabel": "Папка",
  "form.badUrl": "Не похоже на ссылку на YouTube-видео — открой ролик на YouTube",
  "form.pickFolder": "Выбери папку",
  "form.needSupadata":
    "Укажи Supadata API ключ в КАР-точки: Настройки → «Карточки из YouTube» → «Настроить»",
  "form.needLlm":
    "Укажи Gemini или Groq API ключ в КАР-точки: Настройки → «Карточки из YouTube» → «Настроить»",
  "form.empty": "Новых карточек не нашлось — всё уже есть в паках или папках",
  "progress.cancel": "Отмена",
  "progress.fetchVideo": "Получаю данные видео…",
  "progress.generate": "Составляю карточки…",
  "progress.checkSentences": "Проверяю новые предложения…",
  "progress.checkWords": "Проверяю новые слова…",
  "preview.selected": "Выбрано: {n}",
  "preview.title": "Превью",
  "preview.hint": "Отметь, что сохранить, при необходимости поправь перевод",
  "preview.create": "Создать карточки",
  "preview.back": "Назад",
  "preview.group.words": "Слова",
  "preview.group.phrases": "Фразы",
  "preview.group.sentences": "Предложения",
  "save.noSession": "Нет сессии",
  "save.fail": "Не удалось сохранить ({message})",
  "save.created": "Создано: {ok}",
  "save.createdWithFail": "Создано: {ok}, ошибок: {fail}",
  "save.openFolder": "Открыть папку",
  "save.openNamed": "Открыть «{name}»",
  "error.generic": "ошибка",
}

const en: Record<string, string> = {
  "brand.title": "KAR-dots",
  "brand.sub": "Cards from YouTube",
  "fatal.title": "The panel failed to start: {message}",
  "fatal.hint":
    "If this keeps happening — right-click the panel → Inspect and send the Console text.",
  "fatal.retry": "Try again",
  "auth.body": "To save cards to your collection, connect an account on {host}.",
  "auth.login": "Sign in with KAR-dots",
  "auth.hint":
    "The site will open — sign in if needed. The extension picks up the session automatically.",
  "auth.expired": "Session expired — connect your account again",
  "account.connected": "Account connected",
  "account.email": "Account: {email}",
  "account.disconnect": "Disconnect",
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
  "form.folderLabel": "Folder",
  "form.badUrl": "That doesn’t look like a YouTube video URL — open a video on YouTube",
  "form.pickFolder": "Pick a folder",
  "form.needSupadata":
    "Add a Supadata API key in KAR-dots: Settings → YouTube cards → Configure",
  "form.needLlm":
    "Add a Gemini or Groq API key in KAR-dots: Settings → YouTube cards → Configure",
  "form.empty": "No new cards — everything is already in packs or folders",
  "progress.cancel": "Cancel",
  "progress.fetchVideo": "Fetching video…",
  "progress.generate": "Building cards…",
  "progress.checkSentences": "Checking new sentences…",
  "progress.checkWords": "Checking new words…",
  "preview.selected": "Selected: {n}",
  "preview.title": "Preview",
  "preview.hint": "Tick what to keep; edit the translation if needed",
  "preview.create": "Create cards",
  "preview.back": "Back",
  "preview.group.words": "Words",
  "preview.group.phrases": "Phrases",
  "preview.group.sentences": "Sentences",
  "save.noSession": "No session",
  "save.fail": "Could not save ({message})",
  "save.created": "Created: {ok}",
  "save.createdWithFail": "Created: {ok}, failed: {fail}",
  "save.openFolder": "Open folder",
  "save.openNamed": "Open “{name}”",
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
