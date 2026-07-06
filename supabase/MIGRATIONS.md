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

Нужная версия в коде: `REQUIRED_SCHEMA_VERSION` в `js/data/schema-version.js`.

## Как применить

**Рекомендуется — Supabase CLI:** [`SETUP.md`](SETUP.md).

```bash
npm run db:push      # новые миграции в облако
npm run db:status    # проверить статус
```

### Без CLI — SQL Editor

- **Новый проект:** выполните `supabase_schema.sql` целиком.
- **Существующий:** баннер подскажет диапазон; выполните файлы `000N_*.sql` по порядку.

После применения перезагрузите приложение.
