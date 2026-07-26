// ============================================================
// КАР-точки — ссылки на картинки карточек (подписанные URL)
// ============================================================
//
// Бакет card-images должен быть приватным: публичный маршрут
// /storage/v1/object/public/... отдаёт файл вообще без проверки RLS, то есть
// любой, кто узнал (или подобрал) путь, читает чужие картинки.
//
// В карточках при этом по-прежнему хранится публичная ссылка — она стабильна,
// по ней же работает удаление файла. Здесь она превращается в подписанную
// непосредственно перед показом, а результат кэшируется в памяти до истечения
// срока (перевыпуск за минуту до конца, чтобы не отдать протухшую).

import type { MiniSupabase } from "./supabase.js"

/** Бакет с картинками карточек. */
export const IMAGE_BUCKET = "card-images"

/** Срок жизни подписи, секунды. */
export const SIGNED_TTL_SEC = 60 * 60

/** За сколько до конца срока считаем подпись протухшей и подписываем заново. */
export const REFRESH_MARGIN_MS = 60 * 1000

const PUBLIC_MARKER = "/storage/v1/object/public/"

export interface SignedEntry {
  url: string
  expiresAt: number
}

let client: MiniSupabase | null = null
let baseUrl = ""
const cache = new Map<string, SignedEntry>()
const inflight = new Map<string, Promise<string>>()

/** Подключить клиент Supabase (вызывается из CloudStore.init). */
export function configureImageUrls(sb: MiniSupabase | null) {
  client = sb || null
  baseUrl = sb && typeof sb.getBaseUrl === "function" ? sb.getBaseUrl() : ""
  clearImageUrlCache()
}

/** Сбросить кэш подписей (смена пользователя, выход). */
export function clearImageUrlCache() {
  cache.clear()
  inflight.clear()
}

/**
 * Разобрать публичную ссылку storage в {bucket, path}.
 * Чужие адреса, data:/blob:, уже подписанные ссылки → null (их не трогаем).
 */
export function parseStorageUrl(
  url: string | null | undefined,
  base: string = baseUrl
): { bucket: string; path: string } | null {
  const raw = String(url || "")
  if (!raw || !/^https?:\/\//i.test(raw)) return null
  if (!base) return null
  const prefix = base.replace(/\/+$/, "") + PUBLIC_MARKER
  if (!raw.startsWith(prefix)) return null
  // Хвост вида "<bucket>/<path...>"; querystring в публичных ссылках не бывает,
  // но если появился — в путь объекта он не входит.
  const rest = raw.slice(prefix.length).split("?")[0] || ""
  const slash = rest.indexOf("/")
  if (slash <= 0 || slash === rest.length - 1) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

/** Подпись ещё годна (с запасом REFRESH_MARGIN_MS)? */
export function isSignedFresh(entry: SignedEntry | null | undefined, now = Date.now()): boolean {
  if (!entry || !entry.url) return false
  return entry.expiresAt - REFRESH_MARGIN_MS > now
}

/**
 * Синхронный вариант: годная подпись из кэша, иначе — исходное значение.
 * Нужен, чтобы отрисовать <img> сразу, не дожидаясь сети; асинхронный
 * resolveImageUrl потом подменит src, когда подпись приедет.
 */
export function resolveImageUrlSync(url: string | null | undefined): string {
  const raw = String(url || "")
  const parsed = parseStorageUrl(raw)
  if (!parsed) return raw
  const key = parsed.bucket + "/" + parsed.path
  const entry = cache.get(key)
  return isSignedFresh(entry) ? entry!.url : raw
}

/**
 * Подписанная ссылка. Не storage-адрес — возвращаем как есть.
 * Подписать не удалось (офлайн, нет прав) — возвращаем исходное значение:
 * пока бакет публичный, картинка всё равно откроется, а после закрытия
 * бакета «сломанная картинка» лучше пустого экрана.
 */
export async function resolveImageUrl(url: string | null | undefined): Promise<string> {
  const raw = String(url || "")
  const parsed = parseStorageUrl(raw)
  if (!parsed || !client) return raw
  const key = parsed.bucket + "/" + parsed.path

  const entry = cache.get(key)
  if (isSignedFresh(entry)) return entry!.url

  const running = inflight.get(key)
  if (running) return running

  const task = (async () => {
    try {
      const signed = await client!.createSignedUrl(parsed.bucket, parsed.path, SIGNED_TTL_SEC)
      cache.set(key, { url: signed, expiresAt: Date.now() + SIGNED_TTL_SEC * 1000 })
      return signed
    } catch (e) {
      console.warn("[images] не удалось подписать ссылку:", e instanceof Error ? e.message : e)
      return raw
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, task)
  return task
}

/** Подписать пачку ссылок разом (для списка карточек). */
export async function resolveImageUrls(urls: (string | null | undefined)[]): Promise<string[]> {
  return Promise.all((urls || []).map((u) => resolveImageUrl(u)))
}
