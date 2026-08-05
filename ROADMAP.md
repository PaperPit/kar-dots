# Дорожная карта КАР-точек

Живой список идей для **self-hosted open source**. Голосуйте в [Issues](https://github.com/PaperPit/kar-dots/issues).

## Сейчас в продукте

- PWA: локальный режим (IndexedDB) и облако (Supabase)
- SRS: SM-2, FSRS, коробки Лейтнера; 6 режимов повторения
- Импорт из YouTube + Chrome-расширение (RU/EN UI)
- Заметки (Markdown, FTS, граф, wiki-ссылки)
- i18n core screens (ru/en), sync / dead-letter UI в настройках
- Базовый импорт Anki `.apkg` (notes → Front/Back, без media/SRS)
- CSP, API rate-limit, SECURITY.md, coverage gates, Dependabot, CHANGELOG
- Хостинг: **Cloudflare Pages** ([демо](https://kar-tochki.pages.dev))

## Ближайшие направления (нужна помощь)

| Направление | Идея | Сложность |
|-------------|------|-----------|
| **Локализация** | Хвосты: rich-editor, ошибки store, полный EN e2e | средняя |
| **Anki v2** | Медиа + интервалы / cloze | высокая |
| **Статистика** | Heatmap, графики по времени | средняя |
| **Заметки → карточки** | Выделить фрагмент → карточка с якорем | средняя |
| **Граф заметок** | Фильтры, сохраняемые виды | средняя |
| **Коллаборация** | Общие папки / шаринг по ссылке | высокая |
| **Мобильный UX** | Жесты, haptics, review на iOS | средняя |
| **A11y** | axe/Lighthouse в CI; editor + modals | средняя |
| **Extension Store** | Публикация CWS (privacy уже есть) | средняя |
| **Observability** | Опциональные логи CF Functions / post-deploy smoke | средняя |
| **TTS** | Лучший выбор голосов / neural TTS | средняя |

## Дальше по мечте

- Готовые колоды сообщества в `packs/`
- Web Share Target → новая карточка
- Widget «5 карточек за завтраком»
- Readwise / Kindle highlights
- Фразы из подкастов (не только YouTube)

## Как повлиять

1. [Feature request](https://github.com/PaperPit/kar-dots/issues/new?template=feature_request.yml)
2. Опишите **зачем** и **кому**
3. «Могу взять PR» — если готовы помочь кодом

Maintainer отмечает идеи лейблами `accepted` / `good first issue`.
