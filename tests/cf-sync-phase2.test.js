import { describe, it, expect } from "vitest"
import {
  hashPassword,
  normalizeEmail,
  signCfJwt,
  validatePassword,
  verifyCfJwt,
  verifyPassword,
  jwtIssuer
} from "../functions/api/lib/_cf-auth.js"
import { validateSyncPayload } from "../functions/api/lib/_cf-sync.js"
import { maxBodyForScope } from "../functions/api/_middleware.js"

describe("cf-auth", () => {
  it("normalizeEmail + validatePassword", () => {
    expect(normalizeEmail("  A@b.com ")).toBe("a@b.com")
    expect(normalizeEmail("bad")).toBe("")
    expect(validatePassword("1234567").ok).toBe(false)
    expect(validatePassword("12345678").ok).toBe(true)
  })

  it("hash + verify password", async () => {
    const email = "user@example.com"
    const hash = await hashPassword(email, "secret-pass")
    expect(await verifyPassword(email, "secret-pass", hash)).toBe(true)
    expect(await verifyPassword(email, "wrong", hash)).toBe(false)
  })

  it("sign + verify JWT", async () => {
    const secret = "test-secret-key-for-jwt"
    const token = await signCfJwt({ userId: "u1", email: "a@b.com", secret, ttlSec: 3600 })
    expect(jwtIssuer(token)).toBe("kar-cf-sync")
    const v = await verifyCfJwt(token, secret)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.userId).toBe("u1")
      expect(v.email).toBe("a@b.com")
    }
    expect((await verifyCfJwt(token, "wrong")).ok).toBe(false)
  })
})

describe("cf-sync payload", () => {
  it("validateSyncPayload accepts v3 export", () => {
    const payload = validateSyncPayload({
      v: 3,
      folders: [{ id: "f1", name: "A" }],
      cards: [{ id: "c1", front: "a", back: "b" }],
      settings: {},
      boxes: [],
      notes: []
    })
    expect(payload.v).toBe(3)
  })

  it("validateSyncPayload rejects bad version", () => {
    expect(() => validateSyncPayload({ v: 2, folders: [], cards: [] })).toThrow(/version/)
  })
})

describe("middleware sync body limit", () => {
  it("push allows larger body", () => {
    expect(maxBodyForScope("push")).toBeGreaterThan(maxBodyForScope("translate"))
  })
})
