// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  clearImageUrlCache,
  parseStorageUrl,
  isSignedFresh,
  resolveImageUrl,
  resolveImageUrlSync,
  resolveImageUrls,
  IMAGE_BUCKET,
  REFRESH_MARGIN_MS
} from "../js/data/image-url.ts"
import { isR2Ref, r2KeyFromRef, toR2Ref } from "../js/data/cf-files.ts"

const BASE = "https://proj.supabase.co"
const PUB = BASE + "/storage/v1/object/public/" + IMAGE_BUCKET + "/user-1/pic.jpg"
const R2_REF = "r2:user-1/abc.jpg"

describe("parseStorageUrl (legacy)", () => {
  it("parses only public storage urls of this project", () => {
    expect(parseStorageUrl(PUB, BASE)).toEqual({ bucket: IMAGE_BUCKET, path: "user-1/pic.jpg" })
  })

  it("leaves foreign and non-http values alone", () => {
    expect(parseStorageUrl("data:image/png;base64,AAA", BASE)).toBeNull()
    expect(parseStorageUrl(PUB, "")).toBeNull()
  })
})

describe("r2 refs", () => {
  it("detects and parses r2 refs", () => {
    expect(isR2Ref(R2_REF)).toBe(true)
    expect(r2KeyFromRef(R2_REF)).toBe("user-1/abc.jpg")
    expect(toR2Ref("user-1/abc.jpg")).toBe(R2_REF)
  })
})

describe("isSignedFresh", () => {
  const now = 1_000_000

  it("treats a signature as stale a margin before it actually expires", () => {
    expect(isSignedFresh({ url: "s", expiresAt: now + REFRESH_MARGIN_MS + 1 }, now)).toBe(true)
    expect(isSignedFresh({ url: "s", expiresAt: now + REFRESH_MARGIN_MS }, now)).toBe(false)
  })
})

describe("resolveImageUrl (R2)", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearImageUrlCache()
    localStorage.clear()
  })

  beforeEach(() => {
    clearImageUrlCache()
    localStorage.clear()
  })

  it("passes through data URLs", async () => {
    expect(await resolveImageUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA")
  })

  it("signs r2 refs when CF logged in", async () => {
    localStorage.setItem("kar_cf_token", "tok")
    localStorage.setItem("kar_cf_email", "a@b.com")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          url: "/api/files?key=user-1%2Fabc.jpg&exp=9&sig=x"
        })
      }))
    )
    const first = await resolveImageUrl(R2_REF)
    expect(first).toContain("/api/files?")
    expect(resolveImageUrlSync(R2_REF)).toContain("/api/files?")
    const second = await resolveImageUrl(R2_REF)
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("resolveImageUrls maps list", async () => {
    expect(await resolveImageUrls(["data:x", null])).toEqual(["data:x", ""])
  })
})
