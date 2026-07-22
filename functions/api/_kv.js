// Замена Netlify Blobs (стор 'yt-import-jobs') на Workers KV.
// Без биндинга YT_JOBS — in-memory fallback (локальный pages:dev без --kv).

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
