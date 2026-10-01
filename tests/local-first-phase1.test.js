import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { t, setLocale } from "../js/lib/i18n.js"

/**
 * Local-first: boot всегда LocalStore; sync — Cloudflare в Настройках.
 */
describe("local-first phase 1", () => {
  beforeEach(() => {
    setLocale("ru")
    localStorage.clear()
  })
  afterEach(() => {
    setLocale("ru")
    localStorage.clear()
  })

  it("exposes local + CF sync strings", () => {
    expect(t("auth.tryLocal")).toMatch(/устройств/i)
    expect(t("settings.account.localMode")).toBeTruthy()
    expect(t("settings.account.cfHint")).toMatch(/Cloudflare/i)
    expect(t("settings.cfSync.title")).toMatch(/Cloudflare/i)
    expect(t("settings.cfSync.lead")).toMatch(/R2|D1/i)
  })

  it("boot mode rule: always local (cloud rewritten away)", () => {
    function resolveMode(stored) {
      if (stored === "cloud") return "local"
      return stored === "local" ? "local" : "local"
    }
    expect(resolveMode(null)).toBe("local")
    expect(resolveMode("local")).toBe("local")
    expect(resolveMode("cloud")).toBe("local")
  })

  it("EN locale has matching keys", () => {
    setLocale("en")
    expect(t("auth.tryLocal")).toMatch(/device/i)
    expect(t("settings.account.localMode")).toMatch(/Local/i)
  })
})
