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
  "settings.footer": "КАР-точки · v{version}",

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
  "review.flip.hint": "коснитесь, чтобы увидеть перевод",

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
    "Голосовой режим недоступен — используйте ввод текста"
} as const satisfies Record<string, MessageValue>

export type MessageKey = keyof typeof ru
