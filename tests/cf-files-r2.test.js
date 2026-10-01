import { describe, it, expect, beforeEach } from "vitest"
import {
  keyOwnedBy,
  normalizeObjectKey,
  signFileQuery,
  verifyFileQuery,
  stableR2Ref,
  parseR2Ref
} from "../functions/api/lib/_cf-files.js"
import { _handlerForTests as filesHandler } from "../functions/api/files.js"

function mockR2() {
  const map = new Map()
  return {
    map,
    async put(key, buf, opts) {
      map.set(key, { body: buf, httpMetadata: opts?.httpMetadata })
    },
    async get(key) {
      const row = map.get(key)
      if (!row) return null
      return {
        body: row.body,
        httpMetadata: row.httpMetadata
      }
    }
  }
}

describe("cf-files lib", () => {
  it("normalize + ownership", () => {
    expect(normalizeObjectKey("r2:u1/a.jpg")).toBe("u1/a.jpg")
    expect(keyOwnedBy("u1/a.jpg", "u1")).toBe(true)
    expect(keyOwnedBy("u2/a.jpg", "u1")).toBe(false)
    expect(stableR2Ref("u1/a.jpg")).toBe("r2:u1/a.jpg")
    expect(parseR2Ref("r2:u1/a.jpg")).toBe("u1/a.jpg")
  })

  it("sign + verify", async () => {
    const secret = "test-secret"
    const exp = Math.floor(Date.now() / 1000) + 3600
    const sig = await signFileQuery(secret, "u1/a.jpg", exp)
    expect(await verifyFileQuery(secret, "u1/a.jpg", exp, sig)).toBe(true)
    expect(await verifyFileQuery(secret, "u1/a.jpg", exp, "bad")).toBe(false)
  })
})

describe("api/files handler", () => {
  let bucket
  let env

  beforeEach(() => {
    bucket = mockR2()
    env = { CARD_IMAGES: bucket, SYNC_JWT_SECRET: "unit-secret" }
  })

  it("upload + signed get", async () => {
    const png = new Uint8Array([1, 2, 3, 4])
    const up = await filesHandler(
      new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: png
      }),
      env,
      { cfUserId: "user-1" }
    )
    expect(up.status).toBe(200)
    const body = await up.json()
    expect(body.ref).toMatch(/^r2:user-1\//)
    expect(body.url).toContain("/api/files?")

    const get = await filesHandler(
      new Request("http://localhost" + body.url, { method: "GET" }),
      env,
      {}
    )
    expect(get.status).toBe(200)
    expect(get.headers.get("content-type")).toBe("image/png")
  })

  it("rejects upload without cf user", async () => {
    const res = await filesHandler(
      new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: new Uint8Array([1])
      }),
      env,
      {}
    )
    expect(res.status).toBe(401)
  })
})
