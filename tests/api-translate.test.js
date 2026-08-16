import { describe, it, expect, vi, afterEach } from "vitest"
import {
  _handlerForTests as handler,
  _parseDirForTests as parseDir,
  _looksLikeTransliterationForTests as looksLikeTransliteration
} from "../functions/api/translate.js"

describe("api/translate", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("parseDir", () => {
    expect(parseDir("en-ru")).toEqual({ from: "en", to: "ru" })
    expect(parseDir("ru-en")).toEqual({ from: "ru", to: "en" })
  })

  it("детектит транслит onion → Онеон", () => {
    expect(looksLikeTransliteration("onion", "Онеон", "en-ru")).toBe(true)
    expect(looksLikeTransliteration("onion", "лук", "en-ru")).toBe(false)
    expect(looksLikeTransliteration("behind", "позади", "en-ru")).toBe(false)
  })

  it("Llama даёт смысловой перевод; m2m не вызывается", async () => {
    const env = {
      AI: {
        run: vi.fn(async (model) => {
          if (model.includes("llama")) return { response: "лук" }
          throw new Error("m2m should not run")
        })
      }
    }
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "onion", dir: "en-ru" })
    })
    const res = await handler(req, env, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      text: "лук",
      dir: "en-ru",
      provider: "workers-ai-llm"
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("отбрасывает транслит m2m и берёт gtx", async () => {
    const env = {
      AI: {
        run: vi.fn(async (model, input) => {
          if (model.includes("llama")) return { response: "Онеон" }
          expect(input.source_lang).toBe("english")
          expect(input.target_lang).toBe("russian")
          return { translated_text: "Онеон" }
        })
      }
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        expect(String(url)).toContain("translate.googleapis.com")
        return {
          ok: true,
          json: async () => [[["лук", "onion", null, null, 10]]]
        }
      })
    )

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "onion", dir: "en-ru" })
    })
    const res = await handler(req, env, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      text: "лук",
      dir: "en-ru",
      provider: "gtx"
    })
  })

  it("без AI берёт Google gtx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        expect(String(url)).toContain("translate.googleapis.com")
        expect(String(url)).toContain("sl=en")
        expect(String(url)).toContain("tl=ru")
        return {
          ok: true,
          json: async () => [[["лук", "onion", null, null, 10]]]
        }
      })
    )

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "onion", dir: "en-ru" })
    })
    const res = await handler(req, {}, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      text: "лук",
      dir: "en-ru",
      provider: "gtx"
    })
  })

  it("без AI откатывается на MyMemory если gtx упал", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("translate.googleapis.com")) {
          return { ok: false, status: 503, json: async () => ({}) }
        }
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
