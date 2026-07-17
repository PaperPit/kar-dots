# Supabase CLI — настройка для КАР-точки

Один раз настроили — дальше обновление схемы одной командой: `npm run db:push`.

## 1. Установка CLI

**macOS (Homebrew):**

```bash
brew install supabase/tap/supabase
supabase --version
```

**Без Homebrew:** см. [Installing the CLI](https://supabase.com/docs/guides/cli/getting-started?queryGroups=platform&platform=macos).

В этом репозитории CLI уже инициализирован: есть `supabase/config.toml` и миграции в `supabase/migrations/`.

## 2. Вход и привязка проекта

```bash
cd "/Users/lustinaleksej/Claude/Projects/Веб приложение Карточки"

# Откроется браузер для входа в Supabase
supabase login

# Привязать облачный проект (ref — часть URL проекта)
# https://XXXX.supabase.co  →  ref = XXXX
supabase link --project-ref XXXX
```

Пароль базы спросит один раз (тот, что задавали при создании проекта в Supabase).

После `link` в корне появится папка `.supabase/` (в git не коммитится) — там ref и служебные данные связи.

## 3. Синхронизация истории миграций (вы уже применили SQL вручную)

CLI ведёт **свой** журнал в таблице `supabase_migrations.schema_migrations`. Если миграции выполняли через SQL Editor или `supabase_schema.sql`, CLI об этом не знает.

**Один раз** отметьте уже применённые миграции:

```bash
npm run db:repair-init
```

Это эквивалентно:

```bash
supabase migration repair --status applied --linked 0001 0002 0003 0004 0005 0006
```

Проверка:

```bash
npm run db:status
```

В колонке Remote все шесть миграций должны быть **applied**.

## 4. Ежедневная работа

| Команда | Что делает |
|---------|------------|
| `npm run db:status` | Какие миграции применены локально и в облаке |
| `npm run db:push` | Применить **новые** миграции к облачному проекту |

Сгенерировать миграцию из изменений в Dashboard (редко):

```bash
supabase db diff --linked -f описание_изменения
```

После `db:push` перезагрузите приложение — баннер «Обновите базу данных» исчезнет, когда `schema_meta.version` совпадёт с `REQUIRED_SCHEMA_VERSION` в `js/data/schema-version.js`.

## 5. Как добавить новую миграцию (для разработки)

1. Создайте файл `supabase/migrations/0007_описание.sql` (следующий номер).
2. В конце файла повысьте версию:
   ```sql
   insert into public.schema_meta (id, version) values (1, 7)
   on conflict (id) do update set version = 7, updated_at = now();
   ```
3. Поднимите `REQUIRED_SCHEMA_VERSION` в `js/data/schema-version.js` до **7**.
4. Обновите `supabase_schema.sql` (объединение всех миграций для ручного деплоя).
5. Выполните:
   ```bash
   npm run db:push
   ```

## 6. Локальная база (необязательно)

Для экспериментов без облака:

```bash
supabase start    # Docker: локальный Postgres + Studio на :54323
supabase db reset # пересоздать БД из миграций + seed.sql
supabase stop
```

Нужен установленный **Docker Desktop**.

## 7. Частые проблемы

**`supabase: command not found`** — установите CLI (шаг 1), перезапустите терминал.

**`db push` пытается заново применить старые миграции** — выполните `npm run db:repair-init`.

**Баннер в приложении не исчез** — в SQL Editor: `select * from public.schema_meta;` — `version` должна быть ≥ `REQUIRED_SCHEMA_VERSION`.

**Другой компьютер** — склонируйте репозиторий, `supabase login`, `supabase link --project-ref XXXX`, дальше `npm run db:push`.

---

Подробнее о файлах миграций: `supabase/MIGRATIONS.md`.
