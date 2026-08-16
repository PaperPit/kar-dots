// ============================================================
// КАР-точки — лестница форматов по силе следа памяти
//
// Шесть форматов извлечения без связи с состоянием памяти — это шесть
// способов сделать одно и то же. Здесь формат становится функцией силы
// следа: пока карточка незнакома, спрашиваем узнаванием; по мере роста
// стабильности поднимаем трудность до полного воспроизведения.
//
// Обоснование: свободное воспроизведение превосходит узнавание за счёт
// реляционной обработки, НО выигрыш «желательной трудности» возникает
// только при УСПЕШНОМ извлечении. Значит трудность надо повышать по мере
// укрепления следа, а не сразу.
//
// ВАЖНО ПРО ЖУРНАЛ. Формат обязан выводиться детерминированно из
// состояния карточки, а не подбрасываться на каждом показе. Смена
// формата меняет фактическую трудность извлечения: если она скачет
// случайно, одна и та же оценка в журнале начинает означать разные вещи
// и выборка становится непригодной для оптимизатора FSRS. Поэтому здесь
// нет ни одного Math.random(): при равном состоянии карточка всегда
// получает один и тот же формат.
// ============================================================

import { isNew } from "./srs.js"
import type { Algo, SrsRow } from "./srs.js"

/** Ступени по возрастанию трудности извлечения. */
export type LadderRung = "intro" | "familiar" | "assisted" | "full"

/** Форматы, которые лестница умеет назначать. */
export type LadderFormat = "match" | "flip" | "cloze" | "type" | "voice"

/**
 * Порог «зрелой» карточки. 21 день — тот же рубеж young/mature, что и в
 * статистике Anki: выше него карточка считается закреплённой, и требовать
 * полного воспроизведения уже честно.
 */
export const MATURE_DAYS = 21

/**
 * Порог «только что введена или недавно провалена». Ниже него карточка
 * ещё в фазе заучивания, и полное воспроизведение даёт больше провалов,
 * чем пользы.
 */
export const FAMILIAR_DAYS = 2

const DEFAULT_LEITNER = [1, 2, 4, 8, 16]

export interface LadderCaps {
  /** В очереди хватает карточек на раунд «пар». */
  canMatch?: boolean
  /** Из ответа этой карточки строится пропуск. */
  canCloze?: boolean
  /** Распознавание речи доступно в этом браузере. */
  canVoice?: boolean
}

export interface LadderOpts {
  leitnerIntervals?: number[] | null
}

/**
 * Сила следа в днях — общий знаменатель для трёх алгоритмов.
 * FSRS отдаёт стабильность напрямую; у SM-2 роль оценки силы играет
 * текущий интервал; у Лейтнера — интервал коробки.
 * null — карточка ещё ни разу не отвечена.
 */
export function strengthDays(card: SrsRow, algo: Algo, opts: LadderOpts = {}): number | null {
  if (isNew(card, algo)) return null
  if (algo === "fsrs") {
    const s = card.fsrs_stability
    return typeof s === "number" && s > 0 ? s : 0
  }
  if (algo === "leitner") {
    const box = card.box || 0
    if (!box) return null
    const ivs =
      opts.leitnerIntervals && opts.leitnerIntervals.length === 5
        ? opts.leitnerIntervals
        : DEFAULT_LEITNER
    return ivs[box - 1] ?? 0
  }
  const ivl = card.sm2_ivl
  return typeof ivl === "number" && ivl > 0 ? ivl : 0
}

/**
 * Ступень лестницы для карточки.
 *
 * Провал сам опускает карточку вниз без отдельного кода: и FSRS-стабильность,
 * и интервал SM-2, и коробка Лейтнера после промаха падают, а вместе с ними
 * падает и ступень.
 */
export function rungFor(card: SrsRow, algo: Algo, opts: LadderOpts = {}): LadderRung {
  const s = strengthDays(card, algo, opts)
  if (s === null) return "intro"
  if (s < FAMILIAR_DAYS) return "familiar"
  if (s < MATURE_DAYS) return "assisted"
  return "full"
}

/**
 * Устойчивый выбор между «набрать» и «сказать» на верхней ступени.
 * Не Math.random: одна и та же карточка обязана получать один и тот же
 * формат, иначе журнал теряет сопоставимость (см. шапку файла).
 */
function prefersVoice(cardId: string): boolean {
  let h = 0
  for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) | 0
  return (h & 1) === 0
}

/**
 * Формат для ступени с деградацией вниз, если он недоступен для карточки.
 * Вниз, а не вверх: подняться выше назначенной ступени — значит спросить
 * строже, чем заслуживает текущая сила следа.
 */
export function formatForRung(
  rung: LadderRung,
  cardId: string,
  caps: LadderCaps = {}
): LadderFormat {
  const { canMatch = false, canCloze = false, canVoice = false } = caps
  switch (rung) {
    case "intro":
      // Первое знакомство: ответа пользователь ещё не видел, спрашивать
      // воспроизведение бессмысленно. Пары дают узнавание, flip — показ.
      return canMatch ? "match" : "flip"
    case "familiar":
      return "flip"
    case "assisted":
      // Пропуск невозможен обычно на очень коротком ответе — там и полный
      // ввод не тяжелее, поэтому падаем именно в него.
      return canCloze ? "cloze" : "type"
    case "full":
      if (canVoice && prefersVoice(cardId)) return "voice"
      return "type"
  }
}

export interface LadderPick {
  rung: LadderRung
  format: LadderFormat
  /** Сила следа в днях на момент выбора — уходит в журнал вместе с форматом. */
  strength: number | null
}

/** Ступень и формат для карточки одним вызовом. */
export function pickLadderFormat(
  card: SrsRow,
  algo: Algo,
  caps: LadderCaps = {},
  opts: LadderOpts = {}
): LadderPick {
  const strength = strengthDays(card, algo, opts)
  const rung = rungFor(card, algo, opts)
  const cardId = card.id ?? ""
  return { rung, format: formatForRung(rung, cardId, caps), strength }
}
