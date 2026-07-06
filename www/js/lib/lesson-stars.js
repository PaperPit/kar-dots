/**
 * Оценка урока: 1–3 звезды по доле успеха с первой попытки.
 */
export function computeLessonStars({ mode, stats, sessionCards }) {
  const total = Math.max(1, sessionCards || 1);
  const ratio = (stats?.firstTryOk || 0) / total;

  if (ratio >= 0.85) return 3;
  if (ratio >= 0.55) return 2;
  return 1;
}

export function lessonStarsLabel(count) {
  return `${count} из 3`;
}

const FINISH_TITLE = {
  3: 'КАР-р-р! Сегодня ты был великолепен!!!',
  2: 'КАР-р! Двигаешься в верную сторону',
  1: 'Ворон не улетает — попробуй ещё раз',
};

export function lessonFinishTitle(stars) {
  const n = Math.min(3, Math.max(1, stars || 1));
  return FINISH_TITLE[n] || FINISH_TITLE[1];
}
