# Legacy Supabase (архив)

Продуктовый путь — **local IndexedDB + Cloudflare D1 sync + R2 images**.

Папка `supabase/migrations/` в корне репозитория сохранена только как исторический архив схемы Postgres. Не нужна для деплоя Pages.

Миграция данных со старого облака: экспорт JSON из старого инстанса → локальный режим → Cloudflare sync в Настройках.

