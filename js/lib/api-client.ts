/**
 * Личность запроса для /api/*.
 *
 * Бэкенд (functions/api/_middleware.js) выводит субъекта только из того, чему
 * можно верить: проверенный access-token Supabase либо IP + X-Client-Id.
 * Поэтому userId в теле запроса он игнорирует, а вот заголовки нужны всегда:
 * без X-Client-Id анонимные запросы с одного IP сваливаются в общий бюджет
 * лимитов и не находят свои же KV-задачи.
 */

import { sb } from "../core/state.js"
import { getYtJobUserId } from "./yt-job-owner.js"

/** Заголовки для fetch к /api/*: X-Client-Id всегда, Bearer — если есть сессия. */
export async function apiHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  // Тот же id, что и у владельца YouTube-задач, — второй заводить нельзя,
  // иначе анонимный субъект поедет и задача «потеряется».
  const headers: Record<string, string> = Object.assign({ "X-Client-Id": getYtJobUserId() }, extra)
  try {
    const session = await sb?.ensureFresh()
    const token = session?.access_token
    if (token) headers["Authorization"] = "Bearer " + token
  } catch (e) {
    /* нет сессии или сеть — работаем анонимно */
  }
  return headers
}

/** Человеческий текст ошибки /api/*: сообщение сервера, иначе — по статусу. */
export function apiErrorMessage(status: number, serverMessage?: unknown): string {
  const msg = String(serverMessage || "").trim()
  if (msg) return msg
  if (status === 401) return "Сессия истекла — войди заново"
  if (status === 413) return "Слишком большой запрос — уменьши транскрипт"
  if (status === 429) return "Слишком много запросов — попробуй позже"
  if (status >= 500) return "Сервер недоступен — попробуй позже"
  return "Ошибка сервера (" + status + ")"
}
