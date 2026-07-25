# Миграции базы данных (Supabase)

Нумерованные, идемпотентные SQL-файлы лежат в `supabase/migrations/` (только `*.sql` — CLI игнорирует всё остальное).

Каждая миграция повышает `public.schema_meta.version`. Приложение при старте читает `schema_meta.version` и, если она ниже нужной, показывает баннер «Обновите базу данных».

| Файл | version | Что добавляет |
|------|:------:|----------------|
| `0001_init.sql` | 1 | `schema_meta`, `folders`, `cards`, `settings`, индексы, RLS, бакет картинок |
| `0002_folder_icons.sql` | 2 | `folders.icon`, `folders.pack_id`, `folders.pack_version` |
| `0003_fsrs.sql` | 3 | колонки `fsrs_*` у `cards` + индекс |
| `0004_boxes.sql` | 4 | таблица `boxes`, `folders.box_id`, RLS для коробок |
| `0005_updated_at.sql` | 5 | `updated_at` у `folders`/`cards`/`boxes`/`settings` — LWW в офлайн-синке |
| `0006_cards_updated_at_idx.sql` | 6 | индекс `(user_id, updated_at)` на `cards` — delta sync |
| `0007_settings_rls.sql` | 7 | явные RLS-политики для `settings` (фикс ошибки upsert) |
| `0008_review_log.sql` | 8 | таблица `review_log` + RLS |
| `0009_card_images_read_own.sql` | 9 | SELECT `card-images` только своей папки (без публичного list) |
| `0010_boxes_update_with_check.sql` | 10 | `boxes_update_own` — WITH CHECK (нельзя сменить `user_id`) |

Нужная версия в коде: `REQUIRED_SCHEMA_VERSION` в `js/data/schema-version.js`.

## Как применить

**Рекомендуется — Supabase CLI:** [`SETUP.md`](SETUP.md).

```bash
npm run db:push      # новые миграции в облако
npm run db:status    # проверить статус
```

### Без CLI — SQL Editor

Выполните файлы `supabase/migrations/000N_*.sql` **по порядку** (новый проект — с `0001`). Монолитного `supabase_schema.sql` больше нет: источник правды — только миграции.

После применения перезагрузите приложение.
