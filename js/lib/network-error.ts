/** Classify fetch/network failures for offline fallbacks. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true
  if (err && typeof err === "object") {
    const e = err as { name?: string; message?: string; isTimeout?: boolean }
    if (e.isTimeout) return true
    if (e.name === "TypeError" || e.name === "AbortError" || e.name === "TimeoutError") return true
    if (e.message && /failed to fetch|network|load failed/i.test(e.message)) return true
  }
  return false
}
