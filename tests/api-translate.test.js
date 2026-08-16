import { describe, it, expect, vi, afterEach } from "vitest"
import {
  _handlerForTests as handler,
  _parseDirForTests as parseDir
} from "../functions/api/translate.js"

describe("api/translate", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("parseDir", () => {
    expect(parseDir("en-ru")).toEqual({ from: "en", to: "ru" })
    expect(parseDir("ru-en")).toEqual({ from: "ru", to: "en" })
  })

  it("предпочитает Workers AI, если есть биндинг", async () => {
    const env = {
      AI: {
        run: vi.fn(async (model, input) => {
          expect(model).toBe("@cf/meta/m2m100-1.2b")
          expect(input).toEqual({ text: "behind", source_lang: "en", target_lang: "ru" })
          return { translated_text: "позади" }
        })
      }
    }
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "behind", dir: "en-ru" })
    })
    const res = await handler(req, env, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      text: "позади",
      dir: "en-ru",
      provider: "workers-ai"
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("без AI откатывается на MyMemory", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        expect(String(url)).toContain("langpair=ru|en")
        expect(String(url)).toContain(encodeURIComponent("икра"))
        return {
          ok: true,
          json: async () => ({
            responseStatus: 200,
            responseData: { translatedText: "caviar" }
          })
        }
      })
    )

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "икра", dir: "ru-en" })
    })
    const res = await handler(req, {}, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      text: "caviar",
      dir: "ru-en",
      provider: "mymemory"
    })
  })

  it("отклоняет пустой текст", async () => {
    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "  " })
    })
    const res = await handler(req, {}, "test")
    expect(res.status).toBe(400)
  })
})
