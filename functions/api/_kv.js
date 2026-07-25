// Workers KV для YouTube-джобов (локально — in-memory, см. ниже).
// Без биндинга YT_JOBS — in-memory fallback (локальный pages:dev без --kv).
//
// Ключи джобов: job:${subject}:${jobUuid}, где subject выводит middleware
// (functions/api/_middleware.js) из проверенного токена или из IP + X-Client-Id.
// Раньше в ключе был userId прямо из запроса — любой мог прислать чужой UUID и
// прочитать чужую задачу вместе с её ключом Supadata. Клиентский userId больше
// не участвует в ключе вообще.

import { SUBJECT_RE, isSubject } from './lib/_subject.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Терминальные записи (уже без ключа Supadata) живут час. */
export const JOB_TTL_SEC = 3600;

/**
 * Pending-запись содержит личный ключ Supadata — она нужна только пока джоб
 * реально выполняется. Клиент опрашивает статус максимум 3 минуты
 * (js/lib/yt-transcript.ts, POLL_MAX_MS), берём 15 минут с запасом.
 */
export const JOB_PENDING_TTL_SEC = 900;

export { isSubject };

export function isJobUuid(raw) {
  return UUID_RE.test(String(raw || '').trim());
}

/** @param {string} subject @param {string} [jobUuid] */
export function makeJobKey(subject, jobUuid = crypto.randomUUID()) {
  const sub = String(subject || '').trim();
  const jid = String(jobUuid || '').trim();
  if (!isSubject(sub) || !isJobUuid(jid)) {
    throw new Error('invalid job key parts');
  }
  return `job:${sub}:${jid}`;
}

/** @returns {{ subject: string, jobId: string } | null} */
export function parseJobKey(key) {
  const s = String(key || '');
  if (!s.startsWith('job:')) return null;
  const rest = s.slice(4);
  const cut = rest.lastIndexOf(':');
  if (cut <= 0) return null;
  const subject = rest.slice(0, cut);
  const jobId = rest.slice(cut + 1);
  if (!SUBJECT_RE.test(subject) || !isJobUuid(jobId)) return null;
  return { subject, jobId };
}

/** Запись джоба без секретов — то, что безопасно хранить дальше и логировать. */
export function stripJobSecrets(job) {
  if (!job || typeof job !== 'object') return job;
  const clean = { ...job };
  delete clean.apiKey;
  delete clean.supadataApiKey;
  return clean;
}

export function jobsStore(env) {
  const kv = env?.YT_JOBS;
  if (!kv) {
    const mem = globalThis.__ytJobsMem || (globalThis.__ytJobsMem = new Map());
    return {
      async setJSON(key, value) {
        mem.set(key, value);
      },
      async get(key) {
        return mem.has(key) ? mem.get(key) : null;
      },
      async del(key) {
        mem.delete(key);
      },
    };
  }
  return {
    async setJSON(key, value, ttlSec = JOB_TTL_SEC) {
      // Минимум KV — 60 секунд.
      await kv.put(key, JSON.stringify(value), {
        expirationTtl: Math.max(60, Math.floor(ttlSec)),
      });
    },
    async get(key) {
      const raw = await kv.get(key);
      return raw ? JSON.parse(raw) : null;
    },
    async del(key) {
      await kv.delete(key);
    },
  };
}
