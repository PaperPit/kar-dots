# Импорт карточек из YouTube — настройка

Фича: в любой обычной папке появилась кнопка **«Карточки из YouTube»**. Вставляешь ссылку на ролик до 20 минут, выбираешь «Слова / Фразы / Слова + фразы» — приложение достаёт транскрипт через [Supadata](https://supadata.ai), выделяет лексику с переводом на русский, отбрасывает то, что уже есть во встроенных паках (A0/A1/A2/phrases) и в ранее импортированных YouTube-карточках, и показывает превью с галочками. Отмеченное становится карточками текущей папки; в описании карточки — уровень CEFR, часть речи и кликабельный таймкод на момент в видео.

## Архитектура

```
Браузер (js/screens/folder/youtube-dialog.js)
   │  POST /api/yt-video {url, supadataApiKey, …}
   ▼
netlify/functions/yt-video.mjs
   │   1. Supadata GET /youtube/video → title, duration
   │   2. Supadata GET /transcript?url=…&mode=auto
   │   3а. Транскрипт готов → {video, transcript}
   │   3b. Длинное видео → Supadata jobId → {pending, jobId, video}
   ▼ (только в случае 3b)
Браузер: раз в ~2 с опрашивает GET /api/yt-video?jobId=…
   │   (сервер опрашивает Supadata GET /transcript/:jobId)
   ▼
Браузер: POST /api/yt-generate {title, lang, mode, segments, geminiApiKey?, groqApiKey?}
   ▼
netlify/functions/yt-generate.mjs ──► Gemini generateContent (JSON-ответ)
                                    └─► если Gemini отказал → Groq (gpt-oss-120b / gpt-oss-20b …)
   ▼
Браузер: сверка с паками (js/lib/youtube-import.js) → превью → store.createCard
```

Ключ Supadata **обязателен у каждого пользователя** (Настройки → «Карточки из YouTube» → «Настроить»). Gemini и Groq — для генерации карточек; можно указать личные или положиться на серверные ключи в Netlify.

## Регистрация ключей

1. **Supadata** (обязательно) — транскрипт и метаданные YouTube.
   - Зарегистрируйся на <https://supadata.ai>, создай API key.
   - Вставь ключ в приложении: Настройки → «Карточки из YouTube» → «Настроить» → Supadata.
   - Бесплатный тариф покрывает личное использование; одно видео ≈ один запрос.
2. **Google AI Studio** — основной провайдер генерации карточек.
   - На <https://aistudio.google.com> создай API key (free tier).
   - 1 ролик = 1 запрос к Gemini Flash.
3. **Groq** (рекомендуется) — резерв, если у Gemini кончилась квота.
   - На <https://console.groq.com> создай API key.

## Где задаются ключи

| Ключ | Где в приложении | Серверный fallback (Netlify / `.env`) |
|---|---|---|
| Supadata | **обязателен** в настройках | `SUPADATA_API_KEY` — только для локальной разработки |
| Gemini | опционально | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Groq | опционально | `GROQ_API_KEY` |

Личный ключ из настроек **всегда приоритетнее** серверного. Ключи передаются на сервер приложения только при импорте и хранятся в настройках пользователя (синхронизируются с аккаунтом).

После добавления переменных в Netlify нужен redeploy. Функции подхватываются из `netlify/functions/` автоматически.

### О названии модели Gemini

По умолчанию используется алиас **`gemini-flash-latest`**. Если Google вернёт *"model no longer available"*, пропиши актуальное имя в `GEMINI_MODEL` или дождись Groq-резерва.

## Локальная разработка

```bash
npm install
npm run dev    # http://localhost:8080
```

Ключи — из настроек приложения или из `.env` (шаблон `.env.example`). Для опроса длинных транскриптов dev-сервер использует in-memory jobs store (как Netlify Blobs в проде).

Обычный `python3 -m http.server` не подходит — POST `/api/*` не выполняются.

## Ограничения и ошибки

- Ролики длиннее 20 минут отклоняются по метаданным Supadata.
- Длинная расшифровка: Supadata возвращает jobId, клиент опрашивает до ~3 минут.
- Приватные/удалённые видео, исчерпанная квота Supadata/Gemini/Groq — понятные сообщения в диалоге.

| Код | Где | Смысл |
|---|---|---|
| `config` | `yt-video` | Нет Supadata API ключа в настройках |
| `unauthorized` | `yt-video` | Неверный Supadata ключ |
| `quota` / `limit-exceeded` | `yt-video`, `yt-generate` | Исчерпана квота Supadata / Gemini / Groq |
| `transcript-unavailable` | `yt-video` | У видео нет доступного транскрипта |
| `not-found` | `yt-video` | Видео не найдено |
| `too-long` | `yt-video` | Длиннее 20 минут |
| `llm-failed` / `llm-bad-json` | `yt-generate` | Ошибка LLM |
| `no-cards` | `yt-generate` | Модель не нашла лексику |

## Файлы фичи

| Файл | Роль |
|---|---|
| `netlify/functions/lib/supadata.mjs` | клиент Supadata API |
| `netlify/functions/yt-video.mjs` | метаданные + транскрипт через Supadata, polling |
| `netlify/functions/yt-generate.mjs` | Gemini + Groq резерв, генерация карточек |
| `js/lib/youtube-import-settings.js` | чтение ключей, `withApiKeys()` |
| `js/screens/settings/sections/integrations.js` | компактная строка + модальное окно ключей |
| `js/screens/folder/youtube-dialog.js` | диалог импорта |
| `tests/supadata.test.js` | тесты конвертации сегментов |
