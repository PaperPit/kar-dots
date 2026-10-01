// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  isR2Ref,
  r2KeyFromRef,
  toR2Ref,
  cfUploadImageBlob,
  cfSignFileUrl,
  migrateDataUrlsInPayload
} from "../js/data/cf-files.ts"

describe("cf-files client", () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it("ref helpers", () => {
    expect(isR2Ref("r2:u/a.jpg")).toBe(true)
    expect(isR2Ref("/api/files?key=u%2Fa.jpg")).toBe(true)
    expect(r2KeyFromRef("r2:u/a.jpg")).toBe("u/a.jpg")
    expect(toR2Ref("u/a.jpg")).toBe("r2:u/a.jpg")
  })

  it("upload requires CF login", async () => {
    await expect(cfUploadImageBlob(new Blob(["x"], { type: "image/png" }))).rejects.toThrow(
      /Not logged in/i
    )
  })

  it("upload + sign when logged in", async () => {
    localStorage.setItem("kar_cf_token", "tok")
    localStorage.setItem("kar_cf_email", "a@b.com")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts) => {
        if (String(url).includes("/api/files") && opts?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ ref: "r2:u1/x.png", url: "/api/files?key=u1%2Fx.png&exp=1&sig=s" })
          }
        }
        return {
          ok: true,
          json: async () => ({ url: "/api/files?key=u1%2Fx.png&exp=9&sig=y" })
        }
      })
    )
    const ref = await cfUploadImageBlob(new Blob([new Uint8Array([1])], { type: "image/png" }))
    expect(ref).toBe("r2:u1/x.png")
    const signed = await cfSignFileUrl(ref)
    expect(signed).toContain("/api/files?")
  })

  it("migrateDataUrlsInPayload uploads data URLs", async () => {
    localStorage.setItem("kar_cf_token", "tok")
    localStorage.setItem("kar_cf_email", "a@b.com")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts) => {
        if (typeof url === "string" && url.startsWith("data:")) {
          return { blob: async () => new Blob([new Uint8Array([9])], { type: "image/png" }) }
        }
        if (opts?.method === "POST") {
          return { ok: true, json: async () => ({ ref: "r2:u1/m.png" }) }
        }
        return { ok: true, json: async () => ({}) }
      })
    )
    const store = {
      updateCard: vi.fn(async () => {})
    }
    const payload = {
      cards: [{ id: "c1", front_img: "data:image/png;base64,AA==", back_img: "" }]
    }
    await migrateDataUrlsInPayload(store, payload)
    expect(payload.cards[0].front_img).toBe("r2:u1/m.png")
    expect(store.updateCard).toHaveBeenCalled()
  })
})
