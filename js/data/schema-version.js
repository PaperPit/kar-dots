// Версия схемы облачной базы. Заменяет рантайм-угадывание колонок:
// приложение один раз при старте сверяет schema_meta.version с нужной
// и, если она ниже, просит выполнить недостающие миграции.
import { isNetworkError } from './supabase.js';

/**
 * Нужная версия схемы. Должна совпадать с номером последней миграции
 * в supabase/migrations. При добавлении миграции — поднимите это число.
 */
export const REQUIRED_SCHEMA_VERSION = 5;

/**
 * Читает текущую версию схемы из public.schema_meta.
 * Возвращает 0, если таблицы/строки ещё нет (старый проект без миграций).
 * Сетевые ошибки пробрасываются — их обрабатывает офлайн-логика стора.
 * @param {{ select: (table: string, query: string) => Promise<any> }} sb
 * @returns {Promise<number>}
 */
export async function fetchSchemaVersion(sb) {
  try {
    const rows = await sb.select('schema_meta', 'select=version&id=eq.1');
    if (Array.isArray(rows) && rows.length) return Number(rows[0].version) || 0;
    return 0;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    // Таблица/схема отсутствует — считаем версию нулевой.
    return 0;
  }
}

/**
 * Текст баннера для устаревшей схемы или null, если всё актуально.
 * @param {number} current
 * @param {number} required
 * @returns {string|null}
 */
export function schemaOutdatedMessage(current, required = REQUIRED_SCHEMA_VERSION) {
  if (current >= required) return null;
  const from = Math.max(1, current + 1);
  const range = from === required ? `миграцию ${required}` : `миграции ${from}–${required}`;
  return `Обновите базу данных: выполните ${range} из supabase/migrations в Supabase (SQL Editor). `
    + 'Пока изменения сохраняются только на этом устройстве.';
}
