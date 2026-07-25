/** Russian UI catalog — source of truth for default locale. */
export type PluralForms = {
  one: string
  few?: string
  many?: string
  other?: string
}

export type MessageValue = string | PluralForms

export const ru = {
  // —— common ——
  "common.cancel": "Отмена",
  "common.ok": "Ок",
  "common.delete": "Удалить",
  "common.save": "Сохранить",
  "common.create": "Создать",
  "common.back": "Назад",
  "common.name": "Название",
  "common.color": "Цвет",
  "common.icon": "Значок",
  "common.open": "Открыть",
  "common.card": { one: "карточка", few: "карточки", many: "карточек" },
  "common.folder": { one: "папка", few: "папки", many: "папок" },
  "common.error": "Ошибка",
  "common.unknownError": "Неизвестная ошибка",

  // —— app / boot ——
  "app.bootFailed":
    "Не удалось запустить приложение. Откройте консоль браузера (F12) для деталей.",
  "app.bootError": "Ошибка запуска: {message}",

  // —— shell ——
  "shell.nav.home": "Папки",
  "shell.nav.review": "Повторение",
  "shell.nav.stats": "Статистика",
  "shell.nav.settings": "Настройки",
  "shell.offline.short": "Нет сети",
  "shell.offline.local": "Нет сети — данные остаются на этом устройстве.",
  "shell.offline.cloud": "Нет сети — изменения сохранятся локально.",
  "shell.sync.checking": "Проверяю синхронизацию…",
  "shell.sync.waiting": "Нет сети — новые изменения ждут подключения.",
  "shell.sync.pending": "В очереди синхронизации: {n}.",
  "shell.sync.failed": "Не удалось отправить: {n}.",
  "shell.sync.doneFail": "Синхронизировано: {ok}, ошибок: {fail}",
  "shell.sync.doneOk": "Синхронизировано: {ok}",
  "shell.sync.retry": "Повторить",
  "shell.sync.errorTitle": "Ошибка синхронизации",
  "shell.sync.retryStarted": "Повторная синхронизация запущена",
  "shell.sync.alreadyHandled": "Запись уже обработана",
  "shell.sync.retryError": "Повторить ошибку",
  "shell.sync.discarded": "Ошибка синхронизации скрыта",
  "shell.sync.hide": "Скрыть",
  "shell.sync.readFailed": "Не удалось прочитать состояние синхронизации.",

  // —— auth ——
  "auth.sub":
    "Карточки для запоминания слов, терминов и цитат — с умным интервальным повторением.",
  "auth.emailPlaceholder": "Почта",
  "auth.passwordPlaceholder": "Пароль (мин. 6 символов)",
  "auth.signIn": "Войти",
  "auth.signUp": "Создать аккаунт",
  "auth.needCredentials": "Введите почту и пароль не короче 6 символов",
  "auth.confirmEmail": "Письмо отправлено — подтвердите почту и войдите",
  "auth.noAccount": "Нет аккаунта? ",
  "auth.cloudNotConfigured":
    "Облачный режим пока не настроен. Скопируйте js/config.example.js → js/config.js и заполните ключи Supabase (см. docs/USER-GUIDE.md).",
  "auth.tryLocal": "Попробовать без регистрации",
  "auth.opening": "Открываю…",
  "auth.demoNote": "Демо-режим: данные хранятся только в этом браузере.",
  "auth.loadingCloud": "Загружаю ваши карточки…",
  "auth.cloudMissingKeys": "Облачный режим не настроен (нет ключей Supabase)",
  "auth.loadFailed": "Не удалось загрузить данные: {message}",
  "auth.seed.folderName": "Первая папка",
  "auth.seed.cardFront": "КАР-точки",
  "auth.seed.cardBack":
    "Карточки для запоминания.\nНажмите на карточку, чтобы перевернуть.",

  // —— home ——
  "home.toast.alreadyInBox": "Папка уже в этой коробке",
  "home.toast.moveFailed": "Не удалось переместить папку",
  "home.toast.moved": "«{folder}» → «{box}»",
  "home.btn.newBox": "+ Новая коробка",
  "home.btn.newFolder": "+ Новая папка",
  "home.welcome.text":
    "Я — ворона вашей памяти. Создайте папку или коробку, добавьте слова — или установите готовый пак English A0–A2.",
  "home.welcome.createFolder": "Создать первую папку",
  "home.welcome.packs": "Лексические паки",
  "home.section.library": "Библиотека",
  "home.section.libraryAside": "коробки и папки",
  "home.hint.drag": "Перетащите папку на коробку, чтобы объединить.",
  "home.empty.title": "Пока пусто",
  "home.empty.text":
    "Создайте коробку или папку — например, «Английский» или «Философия».",

  "home.greeting.morning": "Доброе утро 👋",
  "home.greeting.afternoon": "Добрый день 👋",
  "home.greeting.evening": "Добрый вечер 👋",
  "home.greeting.done": "На сегодня всё повторено — можно отдыхать",
  "home.greeting.dueOne": "1 карточка ждёт повторения",
  "home.greeting.dueMany": "{n} {cards} ждут повторения",

  "home.day.title": "Повторение дня",
  "home.day.subToday": "результаты сегодня",
  "home.day.weekTitle": "Активность за неделю",
  "home.day.weekSub": "активность за неделю",
  "home.day.weekStats": "статистика",
  "home.day.showWeek": "Показать неделю",
  "home.day.showToday": "Показать сегодня",
  "home.day.of": "из {n}",
  "home.day.known": "Знаю",
  "home.day.unknown": "Не знаю",
  "home.day.left": "Осталось",
  "home.day.knownLower": "знаю",
  "home.day.unknownLower": "не знаю",
  "home.day.continue": "Продолжить",
  "home.day.repeat": "Повторить",
  "home.day.accuracy": "точность {n}%",

  // —— folder / box dialogs ——
  "folder.dialog.titleEdit": "Папка",
  "folder.dialog.titleNew": "Новая папка",
  "folder.dialog.namePlaceholder": "Например, Английский",
  "folder.dialog.iconHint":
    "Если ничего не выбрано — первая буква названия. Повторное нажатие снимает выбор.",
  "folder.dialog.nameRequired": "Введите название",

  "box.dialog.titleEdit": "Коробка",
  "box.dialog.titleNew": "Новая коробка",
  "box.dialog.namePlaceholder": "Например, Английский",
  "box.dialog.foldersLabel": "Папки в коробке",
  "box.dialog.foldersHint":
    "Коробка объединяет папки по теме. Карточки остаются в папках.",
  "box.dialog.noFolders":
    "Нет доступных папок — создайте папку на главном экране.",
  "box.dialog.iconHint":
    "Если ничего не выбрано — первая буква названия. Повторное нажатие снимает выбор.",
  "box.confirm.deleteTitle": "Удалить коробку?",
  "box.confirm.deleteWithFolders":
    "«{name}» будет удалена. {n} {folders} останутся на главном экране.",
  "box.confirm.deleteEmpty": "«{name}» будет удалена.",

  // —— settings (language + chrome used in phase 0/1) ——
  "settings.title": "Настройки",
  "settings.saveFailed": "Не сохранилось: {message}",
  "settings.language.title": "Язык",
  "settings.language.label": "Язык интерфейса",
  "settings.language.hint":
    "Русский — по умолчанию. English подключается по мере перевода экранов.",
  "settings.language.ru": "Русский",
  "settings.language.en": "English",
  "settings.about.title": "Проект",
  "settings.about.github": "GitHub",
  "settings.about.githubHint": "Исходный код приложения на GitHub.",
  "settings.footer": "КАР-точки · v{version}"
} as const satisfies Record<string, MessageValue>

export type MessageKey = keyof typeof ru
