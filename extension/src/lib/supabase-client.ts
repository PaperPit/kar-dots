import type { ExtAuth } from "./constants.js"
import { getAuth, setAuth } from "./storage.js"

class RequestError extends Error {
  status?: number
}

function authError(data: { message?: string; error?: string; error_description?: string; msg?: string }): Error {
  return new Error(data.message || data.error_description || data.error || data.msg || "Ошибка авторизации")
}

function withExpiry(data: ExtAuth["session"] & { expires_in?: number }): ExtAuth["session"] {
  const expires_in = Number(data.expires_in) || 3600
  return {
    ...data,
    expires_at_ms: Date.now() + expires_in * 1000
  }
}

/** Минимальный Supabase-клиент для Side Panel (сессия в chrome.storage). */
export class ExtSupabase {
  url: string
  key: string
  session: ExtAuth["session"] | null

  constructor(auth: ExtAuth) {
    this.url = auth.supabaseUrl.replace(/\/+$/, "")
    this.key = auth.anonKey
    this.session = auth.session
  }

  static async fromStorage(): Promise<ExtSupabase | null> {
    const auth = await getAuth()
    if (!auth?.session?.access_token || !auth.supabaseUrl || !auth.anonKey) return null
    return new ExtSupabase(auth)
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.key,
      Authorization: "Bearer " + (this.session?.access_token || this.key)
    }
  }

  userId(): string | null {
    return this.session?.user?.id ?? null
  }

  email(): string | null {
    return (this.session?.user?.email as string | undefined) || null
  }

  async ensureFresh(): Promise<boolean> {
    if (!this.session?.access_token) return false
    const exp = this.session.expires_at_ms
    if (exp && Date.now() > exp - 2 * 60 * 1000) {
      try {
        await this.refresh()
      } catch {
        return false
      }
    }
    return true
  }

  async refresh(): Promise<void> {
    if (!this.session?.refresh_token) throw new Error("Нет сессии")
    const r = await fetch(this.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: this.key },
      body: JSON.stringify({ refresh_token: this.session.refresh_token })
    })
    const data = await r.json()
    if (!r.ok) {
      await setAuth(null)
      this.session = null
      throw authError(data)
    }
    this.session = withExpiry(data)
    const prev = await getAuth()
    if (prev) {
      await setAuth({
        ...prev,
        session: this.session!,
        connectedAt: prev.connectedAt
      })
    }
  }

  private async handle(r: Response): Promise<unknown> {
    if (r.status === 204) return null
    const text = await r.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!r.ok) {
      const err = new RequestError(
        (data as { message?: string })?.message || r.statusText || "Ошибка запроса"
      )
      err.status = r.status
      throw err
    }
    return data
  }

  async select<T = Record<string, unknown>>(table: string, query?: string): Promise<T[]> {
    if (!(await this.ensureFresh())) throw new Error("Сессия истекла — подключите аккаунт снова")
    const r = await fetch(this.url + "/rest/v1/" + table + (query ? "?" + query : ""), {
      headers: this.headers()
    })
    return (await this.handle(r)) as T[]
  }

  async insert(table: string, row: unknown): Promise<unknown> {
    if (!(await this.ensureFresh())) throw new Error("Сессия истекла — подключите аккаунт снова")
    const r = await fetch(this.url + "/rest/v1/" + table, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    })
    return this.handle(r)
  }
}
