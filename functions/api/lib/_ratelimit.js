// Лимиты запросов на KV: счётчик с фиксированным окном.
//
// Ключ: rl:<scope>:<subject>:<начало окна в epoch-секундах>, значение — счётчик,
// expirationTtl чистит его сам. Окно фиксированное (не скользящее): на границе
// окна возможен всплеск до 2× лимита — для защиты бюджета Worker'а этого хватает.
//
// KV не атомарен: параллельные запросы одного субъекта могут прочитать один и
// тот же счётчик и «потерять» инкремент. Точный лимит потребовал бы Durable
// Object — сознательный компромисс, см. README задачи.

export const HOUR_SEC = 3600;

/** Начало текущего окна (epoch-секунды). */
export function windowStart(nowMs, windowSec = HOUR_SEC) {
  const w = Math.max(1, Math.floor(windowSec));
  return Math.floor(Math.floor(Number(nowMs) / 1000) / w) * w;
}

/** Сколько секунд до конца окна — значение для Retry-After. */
export function retryAfterSec(nowMs, windowSec = HOUR_SEC) {
  const w = Math.max(1, Math.floor(windowSec));
  return Math.max(1, windowStart(nowMs, w) + w - Math.floor(Number(nowMs) / 1000));
}

/** rl:<scope>:<subject>:<окно> — subject уже нормализован (см. _subject.js). */
export function rateLimitKey(scope, subject, windowSec = HOUR_SEC, nowMs = Date.now()) {
  return `rl:${String(scope)}:${String(subject)}:${windowStart(nowMs, windowSec)}`;
}

/**
 * Инкремент счётчика. Возвращает { ok, remaining, retryAfter, skipped, missingKv? }.
 *
 * По умолчанию (локальный pages:dev без --kv) — fail open + console.warn.
 * В проде middleware передаёт failClosed: true → без KV / при ошибке KV
 * запрос отклоняется (503), а не уходит без лимита.
 */
export async function hitRateLimit(
  kv,
  { scope, subject, limit, windowSec = HOUR_SEC, now = Date.now(), failClosed = false } = {},
) {
  const max = Math.max(1, Math.floor(limit));
  if (!kv) {
    console.warn('[ratelimit] нет биндинга KV — лимиты отключены', { scope, failClosed });
    if (failClosed) {
      return { ok: false, skipped: false, remaining: 0, retryAfter: 60, missingKv: true };
    }
    return { ok: true, skipped: true, remaining: max, retryAfter: 0 };
  }
  const key = rateLimitKey(scope, subject, windowSec, now);
  let used = 0;
  try {
    used = Number(await kv.get(key)) || 0;
  } catch (e) {
    console.warn('[ratelimit] KV.get не сработал', scope, e?.message || e);
    if (failClosed) {
      return { ok: false, skipped: false, remaining: 0, retryAfter: 60, missingKv: true };
    }
    return { ok: true, skipped: true, remaining: max, retryAfter: 0 };
  }
  if (used >= max) {
    return { ok: false, skipped: false, remaining: 0, retryAfter: retryAfterSec(now, windowSec) };
  }
  try {
    // TTL с запасом: запись переживает своё окно, но не копится вечно.
    await kv.put(key, String(used + 1), { expirationTtl: Math.max(60, Math.floor(windowSec) + 60) });
  } catch (e) {
    console.warn('[ratelimit] KV.put не сработал — счётчик не увеличен', scope, e?.message || e);
    if (failClosed) {
      return { ok: false, skipped: false, remaining: max - used, retryAfter: 60, missingKv: true };
    }
    return { ok: true, skipped: true, remaining: max - used, retryAfter: 0 };
  }
  return { ok: true, skipped: false, remaining: max - used - 1, retryAfter: 0 };
}
