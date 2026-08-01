/**
 * После деплоя hashed-чанки меняют имена. Старый app.js ещё в памяти/кэше
 * пытается import() старый файл → Failed to fetch dynamically imported module.
 * Один reload обычно подтягивает новый бандл; sessionStorage не даёт зациклиться.
 */

const RELOAD_KEY = "kar_stale_chunk_reload"

export function isStaleModuleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "")
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    msg
  )
}

/** @returns true если инициирован reload (вызывающему не нужно показывать тост). */
export function reloadOnceForStaleChunk(err: unknown): boolean {
  if (typeof location === "undefined" || !isStaleModuleError(err)) return false
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") {
      sessionStorage.removeItem(RELOAD_KEY)
      return false
    }
    sessionStorage.setItem(RELOAD_KEY, "1")
  } catch {
    // sessionStorage недоступен — всё равно пробуем один reload
  }
  location.reload()
  return true
}

/** Сбросить флаг после успешной навигации. */
export function clearStaleChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    /* ignore */
  }
}
