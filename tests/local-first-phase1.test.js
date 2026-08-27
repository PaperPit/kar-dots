import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { t, setLocale } from "../js/lib/i18n.js"

/**
 * Фаза 1 local-first: строки auth/settings и правило выбора режима.
 * Boot-логика в app.ts: cloud только при kar_mode=cloud + session; иначе local.
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

  it("exposes local-first auth and switch-local strings", () => {
    expect(t("auth.tryLocal")).toMatch(/устройств/i)
    expect(t("auth.cloudLegacySummary")).toMatch(/Supabase/i)
    expect(t("settings.account.switchLocalBtn")).toBeTruthy()
    expect(t("settings.sync.localOnly")).toMatch(/Cloudflare|экспорт/i)
  })

  it("boot mode rule: missing or local → local; cloud only when explicit", () => {
    function resolveMode(stored, hasSession) {
      if (stored === "cloud" && hasSession) return "cloud"
      return "local"
    }
    expect(resolveMode(null, false)).toBe("local")
    expect(resolveMode(undefined, true)).toBe("local")
    expect(resolveMode("local", false)).toBe("local")
    expect(resolveMode("cloud", false)).toBe("local")
    expect(resolveMode("cloud", true)).toBe("cloud")
  })

  it("EN locale has matching keys", () => {
    setLocale("en")
    expect(t("auth.tryLocal")).toMatch(/device/i)
    expect(t("settings.account.localMode")).toMatch(/Local/i)
  })
})
