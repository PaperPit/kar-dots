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

  it("Gemini BYOK имеет приоритет", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        expect(String(url)).toContain("generativelanguage.googleapis.com")
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "лук" }] } }]
          })
        }
      })
    )

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "onion",
        dir: "en-ru",
        geminiApiKey: "AIzaSyDummyKeyForTests0123456789"
      })
    })
    const res = await handler(req, {}, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      text: "лук",
      dir: "en-ru",
      provider: "gemini"
    })
  })

  it("Llama даёт смысловой перевод после плохого m2m", async () => {
    const env = {
      AI: {
        run: vi.fn(async (model) => {
          if (String(model).includes("m2m100")) return { translated_text: "Онеон" }
          return { response: "лук" }
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

  it("с ключом Azure — берёт его раньше Lingva/gtx/MyMemory", async () => {
    const fetchSpy = vi.fn(async (url, opts) => {
      expect(String(url)).toContain("api.cognitive.microsofttranslator.com")
      expect(String(url)).toContain("from=en")
      expect(String(url)).toContain("to=ru")
      expect(opts.headers["Ocp-Apim-Subscription-Key"]).toBe("azure-test-key")
      expect(opts.headers["Ocp-Apim-Subscription-Region"]).toBe("westeurope")
      return {
        ok: true,
        json: async () => [{ translations: [{ text: "лук", to: "ru" }] }]
      }
    })
    vi.stubGlobal("fetch", fetchSpy)

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "onion", dir: "en-ru" })
    })
    const env = { AZURE_TRANSLATOR_KEY: "azure-test-key", AZURE_TRANSLATOR_REGION: "westeurope" }
    const res = await handler(req, env, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "лук", dir: "en-ru", provider: "azure" })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("лимит Azure (429/403) не роняет запрос молча — возвращается понятная ошибка", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429 }))
    )

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "onion", dir: "en-ru" })
    })
    const env = { AZURE_TRANSLATOR_KEY: "azure-test-key" }
    const res = await handler(req, env, "test")
    expect(res.status).toBe(429)
    expect((await res.json()).error).toBe("quota")
  })

  it("без AZURE_TRANSLATOR_KEY — Azure тихо пропускается, идём в Lingva", async () => {
    const fetchSpy = vi.fn(async (url) => {
      expect(String(url)).not.toContain("cognitive.microsofttranslator.com")
      expect(String(url)).toContain("lingva.ml")
      return { ok: true, json: async () => ({ translation: "лук" }) }
    })
    vi.stubGlobal("fetch", fetchSpy)

    const req = new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "onion", dir: "en-ru" })
    })
    const res = await handler(req, {}, "test")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "лук", dir: "en-ru", provider: "lingva" })
  })

  it("без AI берёт Lingva", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        expect(String(url)).toContain("lingva.ml")
        return {
          ok: true,
          json: async () => ({ translation: "лук" })
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
      provider: "lingva"
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
