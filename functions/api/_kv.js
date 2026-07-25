// Workers KV для YouTube-джобов (локально — in-memory, см. ниже).
// Без биндинга YT_JOBS — in-memory fallback (локальный pages:dev без --kv).
//
// Ключи джобов: job:${userId}:${jobUuid} — userId только с клиента (Supabase
// или анонимный UUID), jobUuid всегда генерирует сервер.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isJobUserId(raw) {
  return UUID_RE.test(String(raw || '').trim());
}

export function isJobUuid(raw) {
  return UUID_RE.test(String(raw || '').trim());
}

/** @param {string} userId @param {string} [jobUuid] */
export function makeJobKey(userId, jobUuid = crypto.randomUUID()) {
  const uid = String(userId || '').trim();
  const jid = String(jobUuid || '').trim();
  if (!isJobUserId(uid) || !isJobUuid(jid)) {
    throw new Error('invalid job key parts');
  }
  return `job:${uid}:${jid}`;
}

/** @returns {{ userId: string, jobId: string } | null} */
export function parseJobKey(key) {
  const m = /^job:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(String(key || ''));
  if (!m) return null;
  return { userId: m[1], jobId: m[2] };
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
    };
  }
  return {
    async setJSON(key, value) {
      // TTL 1 час — джобы короткоживущие
      await kv.put(key, JSON.stringify(value), { expirationTtl: 3600 });
    },
    async get(key) {
      const raw = await kv.get(key);
      return raw ? JSON.parse(raw) : null;
    },
  };
}
