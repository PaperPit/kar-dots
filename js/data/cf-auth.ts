/**
 * Cloudflare sync — аккаунт (email + пароль, JWT в localStorage).
 */

import { apiErrorMessage } from "../lib/api-client.js"
import { getYtJobUserId } from "../lib/yt-job-owner.js"

const TOKEN_KEY = "kar_cf_token"
const EMAIL_KEY = "kar_cf_email"
const SYNC_AT_KEY = "kar_cf_sync_at"

export function cfLoggedIn(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

export function cfEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY)
}

export function cfToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function cfLastSyncAt(): number {
  return Number(localStorage.getItem(SYNC_AT_KEY) || 0) || 0
}

export function cfSetLastSyncAt(ms: number): void {
  localStorage.setItem(SYNC_AT_KEY, String(Math.max(0, Math.floor(ms))))
}

export function cfLogout(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
  localStorage.removeItem(SYNC_AT_KEY)
}

function saveSession(token: string, email: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EMAIL_KEY, email)
}

async function cfApiHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = Object.assign(
    { "X-Client-Id": getYtJobUserId(), "content-type": "application/json" },
    extra
  )
  const token = cfToken()
  if (token) headers.Authorization = "Bearer " + token
  return headers
}

async function parseApiJson(res: Response): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(res.status, data.message || data.error))
  }
  return data
}

export async function cfRegister(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: await cfApiHeaders(),
    body: JSON.stringify({ email, password })
  })
  const data = await parseApiJson(res)
  const token = String(data.token || "")
  const em = String(data.email || email)
  if (!token) throw new Error("Сервер не вернул токен")
  saveSession(token, em)
}

export async function cfLogin(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: await cfApiHeaders(),
    body: JSON.stringify({ email, password })
  })
  const data = await parseApiJson(res)
  const token = String(data.token || "")
  const em = String(data.email || email)
  if (!token) throw new Error("Сервер не вернул токен")
  saveSession(token, em)
}

export { cfApiHeaders }
