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
  "common.day": { one: "день", few: "дня", many: "дней" },
  "common.error": "Ошибка",
  "common.unknownError": "Неизвестная ошибка",
  "common.show": "Показать",
  "common.hide": "Скрыть",
  "common.done": "Готово",
  "common.download": "Скачать",

  // —— app / boot ——
  "app.bootFailed":
    "Не удалось запустить приложение. Откройте консоль браузера (F12) для деталей.",
  "app.bootError": "Ошибка запуска: {message}",

  // —— shell ——
  "shell.skipToContent": "Перейти к содержимому",
  "shell.nav.aria": "Основная навигация",
  "shell.nav.home": "Папки",
  "shell.nav.homeTab": "Папки",
  "shell.nav.notes": "Заметки",
  "shell.nav.notesTab": "Заметки",
  "shell.nav.review": "Повторение",
  "shell.nav.reviewTab": "Повтор",
  "shell.nav.stats": "Статистика",
  "shell.nav.statsTab": "Стат.",
  "shell.nav.settings": "Настройки",
  "shell.nav.settingsTab": "Ещё",
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
  "shell.schema.outdatedOne":
    "Обновите базу данных: выполните миграцию {n} из supabase/migrations в Supabase (SQL Editor). Пока изменения сохраняются только на этом устройстве.",
  "shell.schema.outdatedRange":
    "Обновите базу данных: выполните миграции {from}–{to} из supabase/migrations в Supabase (SQL Editor). Пока изменения сохраняются только на этом устройстве.",

  // —— глобальные ошибки ——
  "app.error.unexpected": "Что-то пошло не так. Данные сохранены — попробуйте ещё раз.",
  "app.error.reload": "Перезагрузить",
  "app.routeError": "Ошибка экрана: {message}",

  // —— auth ——
  "auth.sub":
    "Карточки для запоминания слов, терминов и цитат — с умным интервальным повторением.",
  "auth.emailPlaceholder": "Почта",
  "auth.emailLabel": "Электронная почта",
  "auth.passwordPlaceholder": "Пароль (мин. 6 символов)",
  "auth.passwordLabel": "Пароль",
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
  "home.notes.kicker": "База знаний",
  "home.notes.title": "Заметки",
  "home.notes.count": "заметок: {n}",
  "home.notes.empty": "Пишите мысли — потом превратите в карточки",

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

  "home.cal.prevMonth": "Предыдущий месяц",
  "home.cal.nextMonth": "Следующий месяц",
  "home.cal.expand": "Открыть календарь активности",
  "home.cal.collapse": "Свернуть календарь",
  "home.cal.dayTip": "{day} {month}",
  "home.cal.dayTipReviews": "{day} {month} · {n} {cards}",
  "home.day.weekBarAria": "{day}: знаю {known}, не знаю {failed}",

  "home.card.folder": "папка",
  "home.card.pack": "Лексический пак",
  "home.card.folderMeta": "папка · {n} {cards}",
  "home.card.boxMeta": "коробка · {folders} · {cards}",
  "home.card.boxAria": "Коробка {label}",
  "home.card.due": "к повторению {n}",

  // —— folder / box dialogs ——
  "folder.dialog.titleEdit": "Папка",
  "folder.dialog.titleNew": "Новая папка",
  "folder.dialog.namePlaceholder": "Например, Английский",
  "folder.dialog.iconHint":
    "Если ничего не выбрано — первая буква названия. Повторное нажатие снимает выбор.",
  "folder.dialog.nameRequired": "Введите название",
  "folder.dialog.colorSwatch": "Цвет {color}",

  // —— folder screen ——
  "folder.screen.rename": "Переименовать",
  "folder.screen.deletePack": "Удалить пак",
  "folder.screen.deleteFolder": "Удалить папку",
  "folder.screen.confirm.deletePackTitle": "Удалить лексический пак?",
  "folder.screen.confirm.deleteFolderTitle": "Удалить папку?",
  "folder.screen.confirm.deletePackBody":
    "«{name}» и все {n} {cards} будут удалены.",
  "folder.screen.confirm.deleteFolderBody":
    "«{name}» и все её карточки ({n}) будут удалены навсегда.",
  "folder.screen.confirm.deletePackOk": "Удалить пак",
  "folder.screen.confirm.deleteCardTitle": "Удалить карточку?",
  "folder.screen.toast.packDeleted": "Пак удалён",
  "folder.screen.toast.folderDeleted": "Папка удалена",
  "folder.screen.toast.cardDeleted": "Карточка удалена",
  "folder.screen.reviewDue": "Повторить ({n})",
  "folder.screen.addCard": "Добавить карточку",
  "folder.screen.addBulk": "Добавить списком",
  "folder.screen.cramAll": "Повторять все карточки",
  "folder.screen.searchPlaceholder": "Поиск по карточкам…",
  "folder.screen.filterAll": "Все",
  "folder.screen.filterDue": "К повторению",
  "folder.screen.emptyFilter": "Ничего не найдено",
  "folder.screen.emptyDue": "Сейчас нет карточек к повторению",
  "folder.screen.packNote":
    "Лексический пак — удаляется целиком через 🗑 или в Настройки → Каталог паков.",
  "folder.screen.chipNew": "новая",
  "folder.screen.chipDue": "пора",
  "folder.screen.chipIn": "через {when}",
  "folder.screen.imageOnly": "(картинка)",
  "folder.screen.deleteCardAria": "Удалить карточку: {front}",
  "folder.screen.noText": "без текста",

  // —— YouTube import dialog ——
  "folder.yt.source.url": "Ссылка",
  "folder.yt.source.file": "Файл субтитров",
  "folder.yt.mode.words": "Слова",
  "folder.yt.mode.phrases": "Фразы",
  "folder.yt.mode.both": "Слова + фразы",
  "folder.yt.mode.sentences": "Предложения",
  "folder.yt.hint.cache": "Транскрипт из кэша",
  "folder.yt.hint.supadata": "Транскрипт через Supadata",
  "folder.yt.hint.file": "Субтитры из файла",
  "folder.yt.fileNone": "Файл не выбран",
  "folder.yt.pickFile": "Выбрать файл",
  "folder.yt.urlOptional": "https://www.youtube.com/watch?v=… (необязательно)",
  "folder.yt.titleOptional": "Название видео (необязательно)",
  "folder.yt.urlIntro":
    "Вставь ссылку на ролик до 20 минут — выберу из него лексику, которой ещё нет в твоих паках.",
  "folder.yt.fileIntro":
    "Загрузи .srt или .vtt — Supadata не нужен. Ссылку можно добавить для таймкодов в карточках.",
  "folder.yt.label.url": "Ссылка на видео",
  "folder.yt.label.file": "Файл субтитров",
  "folder.yt.mergeCues": "Склеивать короткие реплики в предложения",
  "folder.yt.needOnline": "Нужно подключение к интернету",
  "folder.yt.invalidUrl": "Не похоже на ссылку на YouTube-видео",
  "folder.yt.needSupadata":
    "Укажи Supadata API ключ: Настройки → «Карточки из YouTube» → «Настроить»",
  "folder.yt.needGenerate":
    "Укажи Gemini или Groq API ключ: Настройки → «Карточки из YouTube» → «Настроить»",
  "folder.yt.needFile": "Выбери файл .srt или .vtt",
  "folder.yt.getCards": "Получить карточки",
  "folder.yt.whatToExtract": "Что достать из ролика",
  "folder.yt.progress.compose": "Составляю карточки…",
  "folder.yt.progress.checkSentences":
    "Проверяю, какие предложения для тебя новые…",
  "folder.yt.progress.checkWords": "Проверяю, какие слова для тебя новые…",
  "folder.yt.progress.fetchVideo": "Получаю данные видео…",
  "folder.yt.progress.cacheCompose":
    "Транскрипт из кэша — составляю карточки…",
  "folder.yt.progress.readFile": "Читаю файл субтитров…",
  "folder.yt.empty.sentences":
    "Все предложения из этого ролика уже есть в твоих папках — новых карточек не нашлось.",
  "folder.yt.empty.lexicon":
    "Вся лексика из этого ролика уже есть в твоих паках и папках — новых карточек не нашлось.",
  "folder.yt.otherVideo": "Другое видео",
  "folder.yt.gotIt": "Понятно",
  "folder.yt.add": "Добавить",
  "folder.yt.addN": "Добавить ({n})",
  "folder.yt.toast.added": "Добавлено {n} {cards}",
  "folder.yt.toast.addedWithErrors":
    "Добавлено {n} {cards}, ошибок {failed}",
  "folder.yt.toast.addFailed":
    "Не удалось добавить карточки ({n} {errors})",
  "folder.yt.errors": { one: "ошибка", few: "ошибки", many: "ошибок" },
  "folder.yt.dropped.sentences": {
    one: "{n} предложение уже есть в твоих папках — оно скрыты.",
    few: "{n} предложения уже есть в твоих папках — они скрыты.",
    many: "{n} предложений уже есть в твоих папках — они скрыты."
  },
  "folder.yt.dropped.words": {
    one: "{n} слово уже есть в твоих паках — они скрыты.",
    few: "{n} слова уже есть в твоих паках — они скрыты.",
    many: "{n} слов уже есть в твоих паках — они скрыты."
  },
  "folder.yt.truncated":
    "Переведены первые {used} из {total} предложений — лимит за один импорт.",
  "folder.yt.group.sentences": "Предложения",
  "folder.yt.group.phrases": "Фразы",
  "folder.yt.group.words": "Слова",
  "folder.yt.groupTitle": "{title} ({n})",

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
  "box.screen.edit": "Изменить",
  "box.screen.delete": "Удалить коробку",
  "box.screen.foldersTitle": "Папки",
  "box.screen.empty":
    "В коробке пока нет папок. Добавьте существующие через «Изменить» или создайте новую.",
  "box.screen.toast.deleted": "Коробка удалена",
  "box.screen.toast.unboxFailed": "Не удалось вынести папку",
  "box.screen.toast.unboxed": "«{name}» вынесена из коробки",

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
  "settings.footer": "КАР-точки · v{version}",

  "settings.calendar.title": "Календарь",
  "settings.calendar.desktopLabel": "На главной (компьютер)",
  "settings.calendar.desktopHint":
    "Слева или справа от «Повторения дня». На телефоне календарь всегда сверху свёрнутой полоской.",
  "settings.calendar.left": "Слева",
  "settings.calendar.right": "Справа",

  "settings.algo.title": "Интервальное повторение",
  "settings.algo.algorithm": "Алгоритм",
  "settings.algo.footnote":
    "У SM-2, FSRS и Лейтнера свои колонки в базе, поэтому расписание прежнего алгоритма сохраняется и вернётся, если переключиться обратно. Но новый алгоритм своего расписания для этих карточек не имеет — он начнёт с ними с нуля, как с новыми.",
  "settings.algo.confirmTitle": "Сменить алгоритм?",
  "settings.algo.confirmBody":
    "Новый алгоритм начнёт все карточки заново, как новые: даты повторений будут рассчитаны с нуля. Расписание прежнего алгоритма останется в базе — вернётесь к нему, и оно восстановится.",
  "settings.algo.confirmOk": "Сменить",
  "settings.algo.desc.sm2":
    "Классика из Anki. Две кнопки: «Знаю» и «Не знаю». Интервал считается для каждой карточки отдельно — «Не знаю» вернёт её через 10 минут, «Знаю» отодвинет на день и дальше. Простой и привычный режим.",
  "settings.algo.desc.fsrs":
    "Современный алгоритм (как в Anki 23.10+). Четыре оценки: Снова, Трудно, Хорошо, Легко — чем увереннее ответ, тем дольше пауза до следующего показа. Обычно точнее подбирает интервалы, чем SM-2.",
  "settings.algo.desc.leitner":
    "Пять «коробок». Две кнопки: «Помню» — карточка поднимается в следующую коробку, «Не помню» — возвращается в первую. Через сколько дней показывать карточку из каждой коробки — настраивается ниже. Самый простой для понимания.",
  "settings.algo.leitner": "Лейтнер",
  "settings.algo.direction": "Направление",
  "settings.algo.directionHint": "Какую сторону карточки показывать первой.",
  "settings.algo.directionMixed": "Вперемешку",
  "settings.algo.newPerDay": "Новых карточек в день",
  "settings.algo.newPerDayHint": "Чтобы не перегружаться в начале.",
  "settings.algo.reviewsPerDay": "Повторений в день",
  "settings.algo.reviewsPerDayHint":
    "Сколько оценок максимум за календарный день (Знаю / Не знаю).",
  "settings.algo.tts": "Озвучка на повторении",
  "settings.algo.ttsHint":
    "На экране повторения появляется кнопка 🔊. Язык — по тексту (кириллица / латиница). Голоса и скорость настраиваются ниже.",
  "settings.algo.ttsAuto": "Озвучивать при перевороте",
  "settings.algo.ttsAutoOn":
    "Без нажатия на 🔊: после каждого переворота карточки (тап, пробел или Enter) сразу читается видимая сторона. Не срабатывает при оценке «Знаю» / «Не знаю» и не читает карточку до первого переворота.",
  "settings.algo.ttsAutoOff":
    "Сначала включите «Озвучку на повторении» — тогда можно включить автоматическое чтение при перевороте.",
  "settings.algo.ttsRate": "Скорость озвучки",
  "settings.algo.ttsRateHint": "От 0,5× (медленнее) до 2× (быстрее).",
  "settings.algo.voiceAuto": "Авто (лучший доступный)",
  "settings.algo.previewRu": "Прослушать «Привет»",
  "settings.algo.previewRuBtn": "▶ Привет",
  "settings.algo.previewEn": "Прослушать «Hello»",
  "settings.algo.previewEnBtn": "▶ Hello",
  "settings.algo.speechUnavailable": "Speech Synthesis недоступен в этом браузере.",
  "settings.algo.speechVoicesCount":
    "Системных голосов: {n}. «Авто» выбирает лучший для языка текста.",
  "settings.algo.speechVoicesLoading":
    "Голоса загружаются… обновите страницу, если список пуст.",
  "settings.algo.speechVoicesTitle": "Голоса браузера",
  "settings.algo.speechVoicesHint":
    "Speech Synthesis API — без интернета и лимитов. Язык текста определяется автоматически: кириллица → русский, латиница → английский.",
  "settings.algo.voiceRu": "Русский",
  "settings.algo.voiceEn": "Английский",
  "settings.algo.leitnerBoxShort": "Кор. {n}",
  "settings.algo.leitnerIntervals": "Интервалы коробок (дни)",
  "settings.algo.leitnerIntervalsHint":
    "Через сколько дней показывать карточку из каждой коробки.",
  "settings.algo.fsrs.retention": "Желаемое удержание (FSRS)",
  "settings.algo.fsrs.retentionHint":
    "Какую долю карточек вы хотите помнить к моменту повтора. 85–90% оптимально: выше 95% почти удваивает нагрузку, ниже 80% — частое забывание.",
  "settings.algo.fsrs.fuzz": "Выравнивание нагрузки (fuzz)",
  "settings.algo.fsrs.fuzzHint":
    "Небольшой случайный разброс интервалов — повторения не собираются пиками в один день.",
  "settings.algo.fsrs.measured": "Измеренное удержание",
  "settings.algo.fsrs.measuredLoading": "Считаю измеренное удержание…",
  "settings.algo.fsrs.measuredFact": "Факт: {pct} {reviews}. {advice}",
  "settings.algo.fsrs.reviewCount": {
    one: "по {n} повторению",
    few: "по {n} повторениям",
    many: "по {n} повторениям"
  },
  "settings.algo.fsrs.logUnavailable": "Данные журнала недоступны.",
  "settings.algo.fsrs.adviceNodata":
    "Пока мало данных — оценка появится после ~30 повторений изученных карточек.",
  "settings.algo.fsrs.adviceHigh":
    "Измеренное удержание {pct}% выше цели. Можно снизить желаемое удержание до 0.85–0.90 — интервалы вырастут, а нагрузка заметно упадёт почти без потерь.",
  "settings.algo.fsrs.adviceLow":
    "Измеренное удержание {pct}% ниже 80% — карточки часто забываются. Повысьте желаемое удержание ближе к 0.90 или оценивайте строже.",
  "settings.algo.fsrs.adviceOk":
    "Измеренное удержание {pct}% — в здоровом диапазоне 80–95%. Менять цель не нужно.",
  "settings.algo.fsrs.weightsPlaceholder":
    "напр. 0.40, 1.18, 3.17, … — веса из официального оптимизатора FSRS",
  "settings.algo.fsrs.weightsInvalid": "Не похоже на список чисел — не сохранено.",
  "settings.algo.fsrs.weightsSaved": {
    one: "Сохранён {n} вес.",
    few: "Сохранено {n} веса.",
    many: "Сохранено {n} весов."
  },
  "settings.algo.fsrs.weightsReset": "Веса сброшены на стандартные.",
  "settings.algo.fsrs.exportCsv": "Экспорт журнала (CSV)",
  "settings.algo.fsrs.weightsTitle": "Персональные веса FSRS (продвинутое)",
  "settings.algo.fsrs.weightsHint":
    "Полная оптимизация под вашу историю выполняется официальным оптимизатором FSRS. Экспортируйте журнал, прогоните его оптимизатором и вставьте полученные веса сюда.",

  "settings.sounds.title": "Звуки",
  "settings.sounds.uiClicks": "Клики интерфейса",
  "settings.sounds.uiClicksHint":
    "Звук при нажатии кнопок, вкладок и пунктов меню. «Без звука» — тихий интерфейс.",
  "settings.sounds.uiClicksLabel": "Клики",
  "settings.sounds.answerMelodies": "Мелодии ответов",
  "settings.sounds.answerMelodiesHint":
    "Короткие отбивки в режимах «Ввод», «Голос» и «Пары»; отдельно — мелодия при появлении кубка. Нажмите ▶ в меню, чтобы прослушать.",
  "settings.sounds.correct": "Верно",
  "settings.sounds.wrong": "Неверно",
  "settings.sounds.cup": "Кубок",
  "settings.sounds.playWhen": "Озвучивать",
  "settings.sounds.playWhenHint": "Когда проигрывать выбранные мелодии.",
  "settings.sounds.modeBoth": "Оба",
  "settings.sounds.modeCorrect": "Верный",
  "settings.sounds.modeWrong": "Неверный",
  "settings.sounds.modeNone": "Выкл",

  "settings.packs.title": "Лексические паки",
  "settings.packs.cefr": "Уровни CEFR",
  "settings.packs.cefrHint":
    "English A0, A1, A2 — готовые карточки из Oxford 3000 с переводом. Устанавливаются как папка, удаляются целиком.",
  "settings.packs.catalog": "Каталог паков",

  "settings.data.title": "Данные",
  "settings.data.export": "Экспорт",
  "settings.data.exportHint":
    "Скачать все папки и карточки одним файлом (резервная копия).",
  "settings.data.import": "Импорт",
  "settings.data.importHint":
    "Загрузить файл экспорта — например, перенести карточки из демо-режима в облако.",
  "settings.data.importFile": "Выбрать файл",
  "settings.data.importDone": "Импорт завершён",
  "settings.data.importFailed": "Импорт не удался: {message}",

  "settings.account.title": "Режим работы",
  "settings.account.cloudLabel": "Облако: {email}",
  "settings.account.demoMode": "Демо-режим",
  "settings.account.cloudOffline":
    "Сейчас офлайн — данные синхронизируются при появлении сети.",
  "settings.account.cloudOnline": "Карточки синхронизируются между устройствами.",
  "settings.account.demoHint":
    "Данные хранятся только в этом браузере. Настройте Supabase (см. README) для синхронизации.",
  "settings.account.signOut": "Выйти",
  "settings.account.signOutCloudTitle": "Выйти из аккаунта?",
  "settings.account.signOutDemoTitle": "Выйти из демо-режима?",
  "settings.account.signOutCloudText": "Карточки останутся в облаке.",
  "settings.account.signOutDemoText":
    "Данные останутся в этом браузере — вы сможете вернуться.",
  "settings.account.sync": "Синхронизация",
  "settings.account.syncHint": "Принудительно отправить отложенные изменения в облако.",
  "settings.account.syncBtn": "Синхронизировать",
  "settings.account.syncStatsUpdated": "Статистика и очередь обновлены",

  "settings.yt.title": "Карточки из YouTube",
  "settings.yt.apiKeys": "API-ключи",
  "settings.yt.configure": "Настроить",
  "settings.yt.extension": "Расширение Chrome",
  "settings.yt.extensionHint":
    "Кнопка на YouTube → Side Panel с теми же настройками режима",
  "settings.yt.installGuide": "Как установить",
  "settings.yt.modalTitle": "API-ключи YouTube",
  "settings.yt.modalIntro":
    "Supadata обязателен для транскрипта. Для карточек нужен свой Gemini и/или Groq — без них импорт не работает.",
  "settings.yt.supadata.title": "Supadata API ключ",
  "settings.yt.supadata.lead":
    "Обязателен: достаёт субтитры и транскрипт из YouTube.",
  "settings.yt.supadata.step1": "Зарегистрируйся и открой раздел API Keys.",
  "settings.yt.supadata.step2": "Скопируй ключ и вставь сюда.",
  "settings.yt.supadata.step3":
    "Бесплатный тариф покрывает личное использование; одно видео = один запрос.",
  "settings.yt.gemini.title": "Gemini API ключ",
  "settings.yt.gemini.lead": "Генерация карточек: слова и переводы из транскрипта.",
  "settings.yt.gemini.step1": "Создай API key в Google AI Studio.",
  "settings.yt.gemini.step2": "Вставь ключ (AIza… или новый формат AQ.…).",
  "settings.yt.gemini.step3":
    "Без ключа генерация карточек не работает (нужен Gemini или Groq).",
  "settings.yt.groq.title": "Groq API ключ",
  "settings.yt.groq.lead": "Резерв, если у Gemini кончилась квота.",
  "settings.yt.groq.step1": "Создай API Key в Groq Console.",
  "settings.yt.groq.step2": "Вставь ключ (начинается с gsk_…).",
  "settings.yt.groq.step3":
    "Если модели отключены в проекте — Project → Limits: включи GPT OSS.",
  "settings.yt.groq.step4":
    "Без ключа генерация карточек не работает (нужен Gemini или Groq).",
  "settings.yt.invalidGemini":
    "Неверный формат — ключ AI Studio: AIza… или AQ.…",
  "settings.yt.invalidGroq": "Неверный формат — ключ Groq начинается с gsk_…",
  "settings.yt.invalidSupadata": "Неверный формат ключа Supadata",
  "settings.yt.statusMissingRequired": "Не указан — импорт недоступен",
  "settings.yt.statusMissingOptional": "Не указан — нужен Gemini или Groq",
  "settings.yt.statusSaved": "Ключ сохранён",
  "settings.yt.helpOpen": "Открой",
  "settings.yt.helpHow": "Как получить",
  "settings.yt.keyNote":
    "Ключ сохраняется при нажатии «Готово». Передаётся на сервер только при импорте.",

  "settings.media.title": "Картинки для карточек",
  "settings.media.providers": "Pixabay + Giphy",
  "settings.media.providersHint":
    "Бесплатные ключи открывают миллионы фото, иллюстраций, GIF и стикеров.",
  "settings.media.configure": "Настроить",
  "settings.media.modalTitle": "API-ключи для картинок",
  "settings.media.modalIntro":
    "Pixabay — фото и иллюстрации. Giphy — GIF и стикеры. Без ключей работает ограниченный Openverse.",
  "settings.media.pixabay.title": "Pixabay API ключ",
  "settings.media.pixabay.lead":
    "5+ млн фото и иллюстраций (бесплатная лицензия Pixabay).",
  "settings.media.pixabay.step1":
    "Зарегистрируйся на Pixabay и открой API documentation.",
  "settings.media.pixabay.step2": "Скопируй API key и вставь сюда.",
  "settings.media.pixabay.step3":
    "Бесплатно: до 100 запросов в минуту — хватит для личных карточек.",
  "settings.media.giphy.title": "Giphy API ключ",
  "settings.media.giphy.lead": "Огромная база GIF и стикеров.",
  "settings.media.giphy.step1": "Создай приложение в Giphy Developers Dashboard.",
  "settings.media.giphy.step2": "Скопируй API Key.",
  "settings.media.giphy.step3": "Бесплатный тариф подходит для личного использования.",
  "settings.media.invalidPixabay": "Формат: 12345678-abcdef…",
  "settings.media.invalidGiphy": "Неверный формат ключа Giphy",
  "settings.media.statusMissing": "Не указан — базовый поиск Openverse",
  "settings.media.statusSaved": "Ключ сохранён",
  "settings.media.helpOpen": "Открой",
  "settings.media.helpHow": "Как получить",
  "settings.media.keyNote":
    "Ключ сохраняется локально и передаётся на сервер только при поиске картинок.",

  // —— review ——
  "common.grade": { one: "оценка", few: "оценки", many: "оценок" },
  "common.undo": "Отменить",

  "review.side.front": "Лицо",
  "review.side.frontDesc": "Видите термин — вводите или говорите перевод",
  "review.side.back": "Оборот",
  "review.side.backDesc": "Видите перевод — вводите или говорите термин",

  "review.mode.flip.title": "Классический",
  "review.mode.flip.desc": "Переворот карточки и свайп «Знаю / Не знаю»",
  "review.mode.type.title": "Ввод",
  "review.mode.type.desc": "Напечатать перевод или ответ",
  "review.mode.cloze.title": "Пропуски",
  "review.mode.cloze.desc": "Слово — дописать буквы; фраза — дописать слова",
  "review.mode.voice.title": "Голос",
  "review.mode.voice.desc": "Сказать перевод в микрофон",
  "review.mode.combo.title": "Микс",
  "review.mode.combo.desc": "Случайно: ввод, голос или 5 пар слов",
  "review.mode.match.title": "Пары",
  "review.mode.match.desc": "Собрать термины и переводы в пары",

  "review.picker.title": "Режим повторения",
  "review.picker.cramTitle": "Закрепление папки",
  "review.picker.sub": "Выберите, как хотите повторять карточки в этой сессии.",
  "review.picker.cramSub":
    "Выберите сторону, сколько слов повторить и способ закрепления.",
  "review.picker.sideLabel": "Что показывать на карточке?",
  "review.picker.modesLabel": "Способ закрепления",
  "review.picker.limitLabel": "Сколько слов за раз? ",
  "review.picker.limitInFolder": "(в папке {n})",
  "review.picker.limitAll": "Все",
  "review.picker.limitOther": "Другое",
  "review.picker.limitOtherAria": "Другое количество, от 1 до {n}",
  "review.picker.unavailable": "Недоступно в этом браузере",

  "review.empty.limitTitle": "На сегодня лимит",
  "review.empty.limitText":
    "Сегодня уже {done} {grades} из {limit}. Лимит можно увеличить в настройках — или продолжить завтра.",
  "review.empty.toSettings": "К настройкам",
  "review.empty.toFolder": "К папке",
  "review.empty.toFolders": "К папкам",
  "review.empty.toHome": "На главную",
  "review.empty.doneTitle": "КАР-р-р! Сегодня ты был великолепен!!!",
  "review.empty.doneText":
    "Сейчас нет карточек к повторению. Загляните позже — ворона напомнит точками.",
  "review.empty.blankTitle": "Здесь пока пусто",
  "review.empty.blankText": "Добавьте первые слова — и мы начнём повторять.",
  "review.empty.cramFolder": "Закрепить папку",

  "review.intro.cram": "Закрепление · {side} · {mode} — {n} {cards}",
  "review.intro.cramFrom": " из «{name}»",
  "review.intro.regular": "{mode} · {n} {cards}",
  "review.intro.folder": " · «{name}»",

  "review.toolbar.speak": "Озвучить текущую сторону",
  "review.toolbar.edit": "Редактировать карточку",

  "review.session.cardDeleted": "Карточка удалена",
  "review.session.cardSaved": "Карточка сохранена",
  "review.session.skipClozeShort": "Слишком короткий ответ для пропусков — пропуск",
  "review.session.skipNoBack": "Нет перевода для проверки — пропуск",
  "review.session.skipNoFront": "Нет термина для проверки — пропуск",
  "review.session.noTts": "Нет текста для озвучки",
  "review.session.doneTitle": "Сессия завершена!",
  "review.session.doneSub":
    "Ворона довольна. Возвращайтесь завтра — память любит ритм.",
  "review.session.statKnown": "знаю",
  "review.session.statRetry": "повторить ещё",
  "review.session.again": "Ещё раз",

  "review.grade.again": "Снова",
  "review.grade.hard": "Трудно",
  "review.grade.good": "Хорошо",
  "review.grade.easy": "Легко",
  "review.grade.dontKnow": "Не знаю",
  "review.grade.know": "Знаю",
  "review.grade.swipeFsrs": "← снова · → хорошо",
  "review.grade.keysFsrs":
    "← снова · → хорошо · 1–4 — оценки · пробел — перевернуть",
  "review.grade.swipeBinary": "← не знаю · → знаю",
  "review.grade.keysBinary":
    "клавиши: пробел — перевернуть · ← не знаю · → знаю",
  "review.grade.saveFailed": "Не сохранилось: {message}",
  "review.grade.saved": "Оценка сохранена",
  "review.grade.undoFailed": "Не удалось отменить: {message}",
  "review.grade.undone": "Оценка отменена",

  "review.flip.aria": "Карточка — нажмите, чтобы перевернуть",
  "review.flip.ariaNamed": "{text}. Нажмите, чтобы перевернуть",
  "review.flip.hint": "коснитесь, чтобы увидеть перевод",
  "review.face.front": "Слово",
  "review.face.back": "Перевод",
  "review.face.empty": "(пусто)",

  "review.type.placeholderBack": "Введите перевод…",
  "review.type.placeholderFront": "Введите термин…",
  "review.type.check": "Проверить",
  "review.type.wrong": "Неверно",
  "review.type.showAnswer": "Показать ответ",
  "review.type.correctIs": "Правильно: {answer}",
  "review.type.dontKnow": "Не знаю",
  "review.type.correct": "Верно!",
  "review.type.hint": "Введите ответ и нажмите «Проверить»",

  "review.match.hintTermFirst": "Нажмите термин, затем перевод",
  "review.match.hintDefFirst": "Нажмите перевод, затем термин",
  "review.match.empty": "(пусто)",
  "review.match.allDone": "Все пары собраны!",
  "review.match.keepGoing": "Отлично! Продолжайте",
  "review.match.wrongPair": "Не та пара — попробуйте снова",
  "review.match.roundLabel": "Соберите пары · {n}",

  "review.cloze.phraseLabel": "Фраза с пропусками",
  "review.cloze.wordLabel": "Слово с пропусками",
  "review.cloze.ariaWord": "Пропущенное слово",
  "review.cloze.ariaLetter": "Пропущенная буква",
  "review.cloze.hintWords":
    "Допишите пропущенные слова прямо в тексте — только их, не всю фразу",
  "review.cloze.hintLetters":
    "Допишите пропущенные буквы прямо в слове — только их, не слово целиком",

  "review.voice.start": "🎤 Сказать ответ",
  "review.voice.check": "✓ Проверить",
  "review.voice.statusIdle": "Пробел или кнопка — начать запись",
  "review.voice.notRecognized":
    "Речь не распознана — произнесите перевод вслух и нажмите «Проверить»",
  "review.voice.heard": "Услышано: «{transcript}»",
  "review.voice.heardAndCorrect":
    "Услышано: «{transcript}». Правильно: {answer}",
  "review.voice.correctIs": "Правильно: {answer}",
  "review.voice.retry": "🎤 Попробовать снова",
  "review.voice.checking": "Проверяю…",
  "review.voice.checkFailed":
    "Не удалось проверить — нажмите «Сказать ответ» ещё раз",
  "review.voice.listening": "Слушаю: «{text}»",
  "review.voice.unavailable":
    "Голосовой режим недоступен — используйте ввод текста",

  // —— card editor ——
  "cardEditor.title.edit": "Карточка",
  "cardEditor.title.new": "Новая карточка",
  "cardEditor.add": "Добавить",
  "cardEditor.preview": "Просмотр",
  "cardEditor.translate": "Перевести",
  "cardEditor.translate.needFront": "Сначала введите слово на лицевой стороне",
  "cardEditor.translate.confirmReplace": "Заменить текущее определение переводом?",
  "cardEditor.translate.done": "Перевод подставлен",
  "cardEditor.saveMore.title": "Сохранить и добавить ещё одну карточку",
  "cardEditor.saveMore.short": "Сохр. + ещё",
  "cardEditor.saveMore.full": "Сохр. + добавить ещё",

  "cardEditor.form.frontPlaceholder": "Слово или термин",
  "cardEditor.form.definitionPlaceholder": "Краткое определение",
  "cardEditor.form.descriptionPlaceholder": "Показывается на обороте под определением",
  "cardEditor.form.frontLabel": "Лицо",
  "cardEditor.form.frontHint": "Только слово или термин",
  "cardEditor.form.backLabel": "Оборот",
  "cardEditor.form.definitionLabel": "Определение",
  "cardEditor.form.descriptionLabel": "Описание",

  "cardEditor.validation.needFront": "Заполните лицевую сторону",
  "cardEditor.validation.needBack": "Заполните определение или описание на обороте",
  "cardEditor.toast.added": "Карточка добавлена",
  "cardEditor.toast.deleted": "Карточка удалена",
  "cardEditor.confirm.deleteTitle": "Удалить карточку?",

  "cardEditor.bulk.title": "Добавить списком",
  "cardEditor.bulk.hint": "По одной паре на строку.",
  "cardEditor.bulk.placeholder":
    "слово — перевод\nhello — привет\n# комментарии игнорируются",
  "cardEditor.bulk.readyCount": "Готово к добавлению: {ready}",
  "cardEditor.bulk.translateSuffix": " · перевести: {n}",
  "cardEditor.bulk.skippedSuffix": " · пропущено: {n}",
  "cardEditor.bulk.translating": "Перевожу {done} / {total}…",
  "cardEditor.bulk.noneToAdd": "Нет карточек для добавления",
  "cardEditor.bulk.addedCount": "Добавлено карточек: {n}",
  "cardEditor.bulk.translateMissing": "Перевести строки без перевода",
  "cardEditor.bulk.direction": "Направление:",

  "cardEditor.preview.needFront": "Заполните лицевую сторону для просмотра",
  "cardEditor.preview.needBack": "Заполните оборот для просмотра",
  "cardEditor.preview.title": "Просмотр карточки",
  "cardEditor.preview.lead":
    "Как в режиме повторения — нажмите на карточку, чтобы перевернуть.",
  "cardEditor.preview.close": "Закрыть",

  "cardEditor.image.dropAria":
    "Добавить картинку: клик — выбрать файл, Ctrl+V — вставить из буфера обмена",
  "cardEditor.image.remove": "Убрать картинку",
  "cardEditor.image.findStock": "Найти сток",
  "cardEditor.image.add": "+ Картинка",
  "cardEditor.image.hint": "файл, Ctrl+V или сток",

  "cardEditor.stock.openverseFallback": "Openverse (базовый)",
  "cardEditor.stock.tab.photo": "Фото",
  "cardEditor.stock.tab.illustration": "Иллюстрации",
  "cardEditor.stock.tab.gif": "GIF",
  "cardEditor.stock.tab.sticker": "Стикеры",
  "cardEditor.stock.searchPlaceholder": "Слово на русском или английском…",
  "cardEditor.stock.hintGiphy":
    "Без Giphy ключа — базовый Openverse. Настройки → Картинки для карточек.",
  "cardEditor.stock.hintPixabay":
    "Без Pixabay ключа — базовый Openverse. Настройки → Картинки для карточек.",
  "cardEditor.stock.searching": "Ищем…",
  "cardEditor.stock.noResults": "Ничего не найдено — попробуйте другой запрос",
  "cardEditor.stock.enterQuery": "Введите слово для поиска",
  "cardEditor.stock.downloading": "Загружаем…",
  "cardEditor.stock.author": "Автор: {name}",
  "cardEditor.stock.translating": "Переводим и ищем…",
  "cardEditor.stock.queryMapped": "«{from}» → «{to}» · {provider}",
  "cardEditor.stock.lead":
    "Фото, иллюстрации, GIF и стикеры с открытых баз (Pixabay, Giphy, Openverse).",
  "cardEditor.stock.note":
    "Укажите бесплатные API-ключи в настройках для доступа к большим каталогам.",
  "cardEditor.stock.title": "Найти картинку",

  // —— stats ——
  "stats.title": "Статистика",
  "stats.tile.totalReviews": "Всего повторений",
  "stats.tile.uniqueCards": "Изучается карточек",
  "stats.tile.streak": "Серия дней",
  "stats.tile.retention": "Удержание",
  "stats.tile.retentionSub": "по {n} повт.",
  "stats.tile.noData": "нет данных",
  "stats.tile.mature": "Зрелые (≥21д)",
  "stats.tile.matureSub": "{n} карт.",
  "stats.empty":
    "Журнал повторений только начал заполняться. Пройдите первую сессию повторения — и здесь появятся кривые удержания и разбивка по папкам. Прогноз нагрузки ниже уже работает по датам карточек.",
  "stats.section.retention": "Удержание",
  "stats.section.reviews30": "Повторения за 30 дней",
  "stats.section.forecast": "Прогноз нагрузки (14 дней)",
  "stats.section.folders": "По папкам",
  "stats.forecast.today": "сегодня",
  "stats.forecast.barTitle": "{date}: {count} к повтору",
  "stats.forecast.hint":
    "Сколько карточек станут доступны для повтора по текущему алгоритму ({algo}).",
  "stats.folders.none": "Без папки",
  "stats.folders.empty": "Пока нет данных по папкам.",
  "stats.footer": "КАР-точки · статистика ведётся локально",
  "stats.footerCloud": " и синхронизируется с облаком",
  "stats.advice.nodata":
    "Пока мало данных — оценка появится после ~30 повторений изученных карточек.",
  "stats.advice.high":
    "Измеренное удержание {pct}% выше цели. Можно снизить желаемое удержание до 0.85–0.90 — интервалы вырастут, а нагрузка заметно упадёт почти без потерь.",
  "stats.advice.low":
    "Измеренное удержание {pct}% ниже 80% — карточки часто забываются. Повысьте желаемое удержание ближе к 0.90 или оценивайте строже.",
  "stats.advice.ok":
    "Измеренное удержание {pct}% — в здоровом диапазоне 80–95%. Менять цель не нужно.",

  // —— notes ——
  "notes.title": "Заметки",
  "notes.untitled": "Без названия",
  "notes.btn.new": "+ Новая",
  "notes.search.placeholder": "Поиск по заметкам…",
  "notes.search.aria": "Поиск по заметкам",
  "notes.empty.title": "Пока нет заметок",
  "notes.empty.text": "Создайте первую — текст с заголовками и списками, поиск и связь с карточками.",
  "notes.empty.body": "Пустая заметка",
  "notes.toast.missing": "Заметка не найдена",
  "notes.toast.deleted": "Заметка удалена",
  "notes.editor.heading": "Заметка",
  "notes.editor.titlePlaceholder": "Заголовок",
  "notes.editor.titleLabel": "Заголовок заметки",
  "notes.editor.bodyPlaceholder": "Пишите заметку…",
  "notes.editor.bodyLabel": "Текст заметки",
  "notes.editor.preview": "Просмотр",
  "notes.editor.edit": "Редактор",
  "notes.editor.saving": "Сохраняю…",
  "notes.editor.saved": "Сохранено",
  "notes.editor.unsaved": "Изменения…",
  "notes.confirm.deleteTitle": "Удалить заметку?",
  "notes.confirm.deleteBody":
    "Карточки останутся — связь с этой заметкой снимется.",
  "notes.conflicts.title": "Другие версии",
  "notes.conflicts.isCopy": "Это другая версия с другого устройства.",
  "notes.conflicts.banner": "Другая версия — оригинал доступен по ссылке.",
  "notes.conflicts.openOriginal": "Открыть оригинал",
  "notes.cards.title": "Карточки заметки",
  "notes.cards.link": "Связать",
  "notes.cards.linkHint":
    "Чтобы связать карточку: откройте её в редакторе и выберите эту заметку в поле «Заметка».",
  "notes.cards.empty": "Пока нет связанных карточек.",
  "notes.cards.untitled": "Без текста"
} as const satisfies Record<string, MessageValue>

export type MessageKey = keyof typeof ru
