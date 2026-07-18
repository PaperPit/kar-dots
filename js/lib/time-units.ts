export const DAY = 24 * 60 * 60 * 1000
export const MIN = 60 * 1000

export function fmtDays(d: number): string {
  if (d < 1) return "< 1 дня"
  if (d === 1) return "1 день"
  if (d < 30) {
    const n = Math.round(d)
    if (n % 10 === 1 && n % 100 !== 11) return n + " день"
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return n + " дня"
    return n + " дней"
  }
  const m = Math.round(d / 30)
  if (m === 1) return "1 мес"
  return m + " мес"
}
