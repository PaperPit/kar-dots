// ============================================================
// КАР-точки — «шаткие» карточки по журналу повторений
//
// Зачем. Время ответа плохо помогает ПЛАНИРОВАНИЮ: на бенчмарке из сотен
// миллионов повторений модель, потребляющая время ответа, проигрывает
// моделям, которые его игнорируют. Но внутри сессии оно работает —
// связка «медленно, хотя и верно» + недавние промахи выделяет карточки,
// которые вот-вот забудутся, раньше чем это заметит планировщик.
//
// Поэтому латентность здесь НЕ трогает интервалы. Она влияет только на
// две вещи: порядок показа внутри сессии и пометку карточки в списке.
//
// Замечание про приватность и синхронизацию: длительность ответа сильно
// зависит от устройства (набор на телефоне и на клавиатуре — разные
// величины), поэтому она остаётся локальной и не уходит в облако.
// ============================================================

import type { ReviewLogEntry } from "./review-log.js"

/** Сколько последних повторений карточки учитываем. */
export const WINDOW = 8

/** Медленным считаем ответ дольше медианы своего формата в этот раз. */
export const SLOW_FACTOR = 1.5

/** Порог, с которого карточка попадает в «шаткие». */
export const SHAKY_THRESHOLD = 0.34

/** Совсем короткие замеры — шум (промах, случайный тап), в медиану не берём. */
const MIN_DURATION_MS = 250

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  if (sorted.length % 2) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Медиана длительности верного ответа ПО КАЖДОМУ ФОРМАТУ отдельно.
 * Сравнивать набор текста с переворотом карточки бессмысленно: это разные
 * действия и разные величины по своей природе.
 */
export function medianByFormat(entries: ReviewLogEntry[]): Map<string, number> {
  const buckets = new Map<string, number[]>()
  for (const e of entries) {
    const ms = e.duration_ms ?? 0
    if (!e.known || ms < MIN_DURATION_MS) continue
    const key = e.format || "unknown"
    const list = buckets.get(key)
    if (list) list.push(ms)
    else buckets.set(key, [ms])
  }
  const out = new Map<string, number>()
  for (const [k, v] of buckets) out.set(k, median(v))
  return out
}

export interface ShakyStat {
  score: number
  fails: number
  slows: number
  seen: number
}

/**
 * Шаткость каждой карточки в диапазоне 0..1.
 *
 * Промах весит вдвое против медленного верного ответа: провал — прямое
 * свидетельство забывания, медленный ответ — лишь признак напряжения.
 */
export function computeShakiness(entries: ReviewLogEntry[]): Map<string, ShakyStat> {
  const medians = medianByFormat(entries)
  const byCard = new Map<string, ReviewLogEntry[]>()
  for (const e of entries) {
    if (!e.card_id) continue
    const list = byCard.get(e.card_id)
    if (list) list.push(e)
    else byCard.set(e.card_id, [e])
  }

  const out = new Map<string, ShakyStat>()
  for (const [cardId, all] of byCard) {
    const recent = [...all].sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-WINDOW)
    if (!recent.length) continue
    let fails = 0
    let slows = 0
    for (const e of recent) {
      if (!e.known) {
        fails++
        continue
      }
      const ms = e.duration_ms ?? 0
      if (ms < MIN_DURATION_MS) continue
      const med = medians.get(e.format || "unknown") || 0
      if (med > 0 && ms > med * SLOW_FACTOR) slows++
    }
    const score = (2 * fails + slows) / (2 * recent.length)
    out.set(cardId, { score, fails, slows, seen: recent.length })
  }
  return out
}

export function isShaky(stat: ShakyStat | number | undefined | null): boolean {
  if (stat == null) return false
  const score = typeof stat === "number" ? stat : stat.score
  return score >= SHAKY_THRESHOLD
}

/** Идентификаторы шатких карточек — удобно для пометки в списке. */
export function shakyCardIds(entries: ReviewLogEntry[]): Set<string> {
  const out = new Set<string>()
  for (const [cardId, stat] of computeShakiness(entries)) {
    if (isShaky(stat)) out.add(cardId)
  }
  return out
}

/**
 * Поднять шаткие карточки в начало очереди, сохранив исходный порядок
 * внутри каждой группы.
 *
 * Почему в начало: это карточки, ближе всех подошедшие к забыванию, а
 * внимание свежее именно в начале сессии. Плюс если сессию бросят на
 * середине — сделанной окажется самая ценная часть.
 */
export function orderByShakiness<T extends { id?: string }>(
  queue: T[],
  stats: Map<string, ShakyStat>
): T[] {
  const shaky: T[] = []
  const rest: T[] = []
  for (const card of queue) {
    if (isShaky(stats.get(card.id ?? ""))) shaky.push(card)
    else rest.push(card)
  }
  if (!shaky.length) return queue
  shaky.sort((a, b) => {
    const sa = stats.get(a.id ?? "")?.score ?? 0
    const sb = stats.get(b.id ?? "")?.score ?? 0
    return sb - sa
  })
  return shaky.concat(rest)
}
