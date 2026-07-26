# Chrome-расширение: карточки из YouTube

Расширение добавляет кнопку **«Карточки»** в правом верхнем углу YouTube. По нажатию открывается Side Panel с теми же настройками режима, что в диалоге приложения (Слова / Фразы / Слова+фразы / Предложения), превью с галочками и сохранением в облачный аккаунт на [kar-tochki.pages.dev](https://kar-tochki.pages.dev).

## Установка (unpacked)

1. Соберите расширение из корня репозитория:

```bash
npm install
npm run ext:build
```

2. Откройте Chrome → `chrome://extensions` → включите **Developer mode**.
3. **Load unpacked** → выберите папку `extension/` (не `extension/src`, не корень репо).
4. На [kar-tochki.pages.dev](https://kar-tochki.pages.dev/?ext_connect=1) войдите в облачный аккаунт (если ещё не вошли). Баннер подтвердит подключение.
5. Откройте **страницу ролика** на YouTube (`/watch?v=…`) → нажмите **Карточки** на странице или иконку расширения → Side Panel → режим и папка → **Сформировать** → отметьте карточки → **Создать**.

### Пустая бежевая панель

1. `chrome://extensions` → КАР-точки → **Errors** (если есть — пришлите текст).
2. **Reload** расширения.
3. Убедитесь, что Load unpacked = папка `extension/` и после `git pull` снова выполнен `npm run ext:build`.
4. Откройте именно видео, не главную YouTube.

## Что нужно заранее

- Облачный аккаунт на прод-инстансе.
- Хотя бы одна обычная папка (не vocab-pack).
- **Supadata API ключ** в Настройки → «Карточки из YouTube» → «Настроить» (как в веб-приложении).
- Ролик до **20 минут**, с доступными субтитрами.

## Ограничения v1

- Только Chrome (MV3), только `https://kar-tochki.pages.dev`.
- Нет импорта `.srt` / `.vtt` из расширения (только текущий ролик).
- Нужен интернет; офлайн-очередь SyncQueue не используется.
- Публикация в Chrome Web Store — отдельно; сейчас только load unpacked.

## Структура

| Путь | Назначение |
|---|---|
| `extension/manifest.json` | MV3 манифест |
| `extension/src/` | исходники (background, content scripts, side panel) |
| `extension/dist/` | сборка (`npm run ext:build`) |
| `js/lib/ext-connect.ts` | bridge `?ext_connect=1` в PWA |

## Отключение

В Side Panel → **Отключить** (чистит сессию в `chrome.storage`). Либо удалите расширение в `chrome://extensions`.
