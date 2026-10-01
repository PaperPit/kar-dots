// Подпись URL для приватного R2 (HMAC-SHA256, query exp+sig).

function b64url(bytes) {
  const bin = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ""
  for (const b of bin) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4))
  const b64 = String(str).replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

/** Ключ объекта: userId/uuid.ext — без .. и ведущих слэшей. */
export function normalizeObjectKey(raw) {
  const key = String(raw || "")
    .replace(/^r2:/i, "")
    .replace(/^\/+/, "")
    .trim()
  if (!key || key.includes("..") || key.length > 512) return ""
  if (!/^[A-Za-z0-9._/-]+$/.test(key)) return ""
  return key
}

export function keyOwnedBy(key, userId) {
  const k = normalizeObjectKey(key)
  const uid = String(userId || "").trim()
  if (!k || !uid) return false
  return k.startsWith(uid + "/")
}

export async function signFileQuery(secret, key, expSec) {
  const payload = `${normalizeObjectKey(key)}.${expSec}`
  const keyCrypto = await hmacKey(secret)
  const sig = await crypto.subtle.sign("HMAC", keyCrypto, new TextEncoder().encode(payload))
  return b64url(new Uint8Array(sig))
}

export async function verifyFileQuery(secret, key, expSec, sig) {
  const exp = Number(expSec)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false
  const expected = await signFileQuery(secret, key, exp)
  const a = b64urlDecode(expected)
  let b
  try {
    b = b64urlDecode(String(sig || ""))
  } catch {
    return false
  }
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export const FILE_SIGN_TTL_SEC = 60 * 60
export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
])

export function extForType(type) {
  const t = String(type || "").toLowerCase()
  if (t.includes("png")) return "png"
  if (t.includes("webp")) return "webp"
  if (t.includes("gif")) return "gif"
  return "jpg"
}

export function stableR2Ref(key) {
  return "r2:" + normalizeObjectKey(key)
}

export function parseR2Ref(raw) {
  const s = String(raw || "")
  if (/^r2:/i.test(s)) return normalizeObjectKey(s)
  // same-origin /api/files?key=...
  try {
    if (s.includes("/api/files")) {
      const u = new URL(s, "https://example.invalid")
      return normalizeObjectKey(u.searchParams.get("key") || "")
    }
  } catch {
    /* ignore */
  }
  return ""
}
