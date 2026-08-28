// Auth для Cloudflare sync: PBKDF2 + подписанный JWT (iss=kar-cf-sync).

export const CF_JWT_ISS = "kar-cf-sync"
export const CF_JWT_TTL_SEC = 60 * 60 * 24 * 30 // 30 дней

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

export function normalizeEmail(raw) {
  const email = String(raw || "")
    .trim()
    .toLowerCase()
  return EMAIL_RE.test(email) ? email : ""
}

export function validatePassword(raw) {
  const password = String(raw || "")
  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: `Пароль не короче ${MIN_PASSWORD} символов` }
  }
  return { ok: true, password }
}

function b64url(bytes) {
  const bin = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ""
  for (const b of bin) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4))
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function jwtPartDecode(part) {
  const json = new TextDecoder().decode(b64urlDecode(part))
  return JSON.parse(json)
}

/** Issuer из JWT без проверки подписи — для маршрутизации в middleware. */
export function jwtIssuer(token) {
  try {
    const parts = String(token || "").split(".")
    if (parts.length !== 3) return ""
    const payload = jwtPartDecode(parts[1])
    return String(payload?.iss || "")
  } catch {
    return ""
  }
}

async function importHmacKey(secret) {
  const raw = new TextEncoder().encode(String(secret || ""))
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify"
  ])
}

export async function hashPassword(email, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${email}\0${password}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    256
  )
  return `pbkdf2$120000$${b64url(salt)}$${b64url(new Uint8Array(bits))}`
}

export async function verifyPassword(email, password, stored) {
  const m = /^pbkdf2\$(\d+)\$([^$]+)\$([^$]+)$/.exec(String(stored || ""))
  if (!m) return false
  const iterations = Number(m[1])
  const salt = b64urlDecode(m[2])
  const expected = b64urlDecode(m[3])
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${email}\0${password}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  )
  const got = new Uint8Array(bits)
  if (got.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i]
  return diff === 0
}

export async function signCfJwt({ userId, email, secret, ttlSec = CF_JWT_TTL_SEC }) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "HS256", typ: "JWT" }
  const payload = {
    iss: CF_JWT_ISS,
    sub: String(userId),
    email: String(email),
    iat: now,
    exp: now + ttlSec
  }
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)))
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const data = `${h}.${p}`
  const key = await importHmacKey(secret)
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
  return `${data}.${b64url(new Uint8Array(sig))}`
}

export async function verifyCfJwt(token, secret) {
  const parts = String(token || "").split(".")
  if (parts.length !== 3) return { ok: false, code: "bad-token" }
  let payload
  try {
    payload = jwtPartDecode(parts[1])
  } catch {
    return { ok: false, code: "bad-token" }
  }
  if (payload?.iss !== CF_JWT_ISS) return { ok: false, code: "bad-issuer" }
  const now = Math.floor(Date.now() / 1000)
  if (!payload?.exp || payload.exp < now) return { ok: false, code: "expired" }
  const data = `${parts[0]}.${parts[1]}`
  const key = await importHmacKey(secret)
  let sigOk = false
  try {
    sigOk = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(parts[2]),
      new TextEncoder().encode(data)
    )
  } catch {
    sigOk = false
  }
  if (!sigOk) return { ok: false, code: "bad-signature" }
  const userId = String(payload.sub || "").trim()
  if (!userId) return { ok: false, code: "bad-subject" }
  return { ok: true, userId, email: String(payload.email || "") }
}

export function newUserId() {
  return crypto.randomUUID()
}
