// ============================================================
// КАР-точки — алгоритмы интервального повторения
// Два движка: SM-2 (как в Anki) и коробки Лейтнера.
// Состояние обоих движков хранится на карточке независимо,
// поэтому алгоритм можно переключать без потери прогресса.
// ============================================================
(function () {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;
  const MIN = 60 * 1000;

  // --- SM-2 -------------------------------------------------
  // Оценки: 0 = снова, 3 = трудно, 4 = хорошо, 5 = легко
  function sm2Next(card, quality, now) {
    now = now || Date.now();
    let ef = card.sm2_ef || 2.5;
    let reps = card.sm2_reps || 0;
    let ivl = card.sm2_ivl || 0; // интервал в днях

    if (quality < 3) {
      // забыл: сбрасываем серию, показываем снова через 10 минут
      reps = 0;
      ivl = 0;
      ef = Math.max(1.3, ef - 0.2);
      return { sm2_ef: ef, sm2_reps: reps, sm2_ivl: ivl, sm2_due: now + 10 * MIN };
    }

    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ef = Math.max(1.3, ef);
    reps += 1;

    if (reps === 1) ivl = quality === 5 ? 4 : 1;
    else if (reps === 2) ivl = quality === 5 ? 8 : 6;
    else ivl = Math.round(ivl * ef);

    if (quality === 3) ivl = Math.max(1, Math.round(ivl * 0.8)); // «трудно» растёт медленнее
    ivl = Math.min(ivl, 365);

    return { sm2_ef: ef, sm2_reps: reps, sm2_ivl: ivl, sm2_due: now + ivl * DAY };
  }

  // --- Коробки Лейтнера ------------------------------------
  // 5 коробок; помню → следующая коробка, не помню → в первую.
  function leitnerNext(card, remembered, intervals, now) {
    now = now || Date.now();
    intervals = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16];
    let box = card.box || 0; // 0 = новая
    if (remembered) box = Math.min(5, box + 1);
    else box = 1;
    const days = intervals[box - 1];
    return { box: box, box_due: now + days * DAY };
  }

  // due карточки для выбранного алгоритма
  function dueOf(card, algo) {
    if (algo === 'leitner') return card.box ? card.box_due : null; // null = новая
    return card.sm2_reps || card.sm2_due ? card.sm2_due : null;
  }

  function isNew(card, algo) {
    if (algo === 'leitner') return !card.box;
    return !card.sm2_reps && !card.sm2_due;
  }

  function isDue(card, algo, now) {
    now = now || Date.now();
    const d = dueOf(card, algo);
    return d !== null && d !== undefined && d <= now;
  }

  // Человекочитаемый прогноз интервала для кнопок SM-2
  function sm2Preview(card, quality, now) {
    const r = sm2Next(Object.assign({}, card), quality, now);
    if (quality < 3) return '10 мин';
    return fmtDays(r.sm2_ivl);
  }

  function leitnerPreview(card, remembered, intervals) {
    const r = leitnerNext(Object.assign({}, card), remembered, intervals);
    const ivs = intervals && intervals.length === 5 ? intervals : [1, 2, 4, 8, 16];
    return fmtDays(ivs[r.box - 1]);
  }

  function fmtDays(d) {
    if (d < 1) return '< 1 дня';
    if (d === 1) return '1 день';
    if (d < 30) {
      const n = Math.round(d);
      if (n % 10 === 1 && n % 100 !== 11) return n + ' день';
      if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return n + ' дня';
      return n + ' дней';
    }
    const m = Math.round(d / 30);
    if (m === 1) return '1 мес';
    return m + ' мес';
  }

  window.SRS = { sm2Next, leitnerNext, dueOf, isNew, isDue, sm2Preview, leitnerPreview, fmtDays, DAY, MIN };
})();
