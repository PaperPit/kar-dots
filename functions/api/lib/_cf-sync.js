// D1 helpers для snapshot-синка.

export function syncDb(env) {
  return env?.SYNC_DB || null
}

export async function findUserByEmail(db, email) {
  return db
    .prepare("SELECT id, email, password_hash, created_at FROM cf_users WHERE email = ?")
    .bind(email)
    .first()
}

export async function findUserById(db, userId) {
  return db
    .prepare("SELECT id, email, created_at FROM cf_users WHERE id = ?")
    .bind(userId)
    .first()
}

export async function insertUser(db, { id, email, passwordHash, createdAt }) {
  await db
    .prepare("INSERT INTO cf_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, email, passwordHash, createdAt)
    .run()
}

export async function getSnapshot(db, userId) {
  return db
    .prepare("SELECT user_id, payload, updated_at, client_id FROM cf_sync_snapshots WHERE user_id = ?")
    .bind(userId)
    .first()
}

export async function upsertSnapshot(db, { userId, payload, updatedAt, clientId }) {
  await db
    .prepare(
      `INSERT INTO cf_sync_snapshots (user_id, payload, updated_at, client_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at,
         client_id = excluded.client_id`
    )
    .bind(userId, payload, updatedAt, clientId || null)
    .run()
}

/** Минимальная проверка export JSON v3 перед записью в D1. */
export function validateSyncPayload(data) {
  if (!data || typeof data !== "object") throw new Error("payload: not an object")
  const obj = data
  if (obj.v !== 3) throw new Error("payload: unsupported version")
  if (!Array.isArray(obj.folders)) throw new Error("payload: folders[] required")
  if (!Array.isArray(obj.cards)) throw new Error("payload: cards[] required")
  if (obj.boxes && !Array.isArray(obj.boxes)) throw new Error("payload: boxes must be array")
  if (obj.notes && !Array.isArray(obj.notes)) throw new Error("payload: notes must be array")
  if (obj.settings && (typeof obj.settings !== "object" || obj.settings === null)) {
    throw new Error("payload: settings must be object")
  }
  return obj
}

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  })
}
