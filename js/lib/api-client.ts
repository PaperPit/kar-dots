/**
 * Личность запроса для /api/*.
 *
 * Бэкенд выводит субъекта из CF sync JWT (`kar-cf-sync`) либо IP + X-Client-Id.
 */

import { getYtJobUserId } from "./yt-job-owner.js"

/** Заголовки для fetch к /api/*: X-Client-Id всегда, Bearer — если есть CF sync сессия. */
export async function apiHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = Object.assign({ "X-Client-Id": getYtJobUserId() }, extra)
  try {
    const token = localStorage.getItem("kar_cf_token")
    if (token) headers["Authorization"] = "Bearer " + token
  } catch {
    /* нет storage — работаем анонимно */
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
