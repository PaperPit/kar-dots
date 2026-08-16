import { describe, it, expect } from 'vitest';
import {
  strengthDays,
  rungFor,
  formatForRung,
  pickLadderFormat,
  MATURE_DAYS,
  FAMILIAR_DAYS,
} from '../js/lib/format-ladder.ts';

const ALL = { canMatch: true, canCloze: true, canVoice: true };

describe('сила следа как общий знаменатель трёх алгоритмов', () => {
  it('FSRS — стабильность напрямую', () => {
    expect(strengthDays({ fsrs_reps: 3, fsrs_stability: 12.5 }, 'fsrs')).toBe(12.5);
  });

  it('SM-2 — текущий интервал', () => {
    expect(strengthDays({ sm2_reps: 2, sm2_ivl: 6 }, 'sm2')).toBe(6);
  });

  it('Лейтнер — интервал коробки', () => {
    expect(strengthDays({ box: 3 }, 'leitner', { leitnerIntervals: [1, 2, 4, 8, 16] })).toBe(4);
  });

  it('новая карточка — null в любом алгоритме', () => {
    expect(strengthDays({}, 'fsrs')).toBeNull();
    expect(strengthDays({}, 'sm2')).toBeNull();
    expect(strengthDays({}, 'leitner')).toBeNull();
  });
});

describe('ступень растёт вместе с силой следа', () => {
  it('новая → intro, слабая → familiar, молодая → assisted, зрелая → full', () => {
    expect(rungFor({}, 'fsrs')).toBe('intro');
    expect(rungFor({ fsrs_reps: 1, fsrs_stability: 0.5 }, 'fsrs')).toBe('familiar');
    expect(rungFor({ fsrs_reps: 2, fsrs_stability: 5 }, 'fsrs')).toBe('assisted');
    expect(rungFor({ fsrs_reps: 9, fsrs_stability: 90 }, 'fsrs')).toBe('full');
  });

  it('границы ступеней — ровно на пороге', () => {
    expect(rungFor({ fsrs_reps: 1, fsrs_stability: FAMILIAR_DAYS - 0.01 }, 'fsrs')).toBe('familiar');
    expect(rungFor({ fsrs_reps: 1, fsrs_stability: FAMILIAR_DAYS }, 'fsrs')).toBe('assisted');
    expect(rungFor({ fsrs_reps: 1, fsrs_stability: MATURE_DAYS - 0.01 }, 'fsrs')).toBe('assisted');
    expect(rungFor({ fsrs_reps: 1, fsrs_stability: MATURE_DAYS }, 'fsrs')).toBe('full');
  });

  it('промах опускает ступень сам собой — через упавшую стабильность', () => {
    const mature = { id: 'a', fsrs_reps: 9, fsrs_stability: 60 };
    expect(rungFor(mature, 'fsrs')).toBe('full');
    // FSRS после Again роняет стабильность; отдельного кода для «ступень вниз» нет.
    const lapsed = { ...mature, fsrs_stability: 0.8, fsrs_lapses: 1 };
    expect(rungFor(lapsed, 'fsrs')).toBe('familiar');
  });
});

describe('формат ступени и деградация вниз', () => {
  it('лестница от узнавания к полному воспроизведению', () => {
    expect(formatForRung('intro', 'x', ALL)).toBe('match');
    expect(formatForRung('familiar', 'x', ALL)).toBe('flip');
    expect(formatForRung('assisted', 'x', ALL)).toBe('cloze');
    expect(['type', 'voice']).toContain(formatForRung('full', 'x', ALL));
  });

  it('нет раунда пар — знакомство через flip, а не через ввод', () => {
    expect(formatForRung('intro', 'x', { ...ALL, canMatch: false })).toBe('flip');
  });

  it('пропуск не строится — падаем в ввод, а не поднимаемся в голос', () => {
    expect(formatForRung('assisted', 'x', { ...ALL, canCloze: false })).toBe('type');
  });

  it('без распознавания речи верхняя ступень — ввод', () => {
    expect(formatForRung('full', 'x', { ...ALL, canVoice: false })).toBe('type');
  });
});

describe('детерминированность — условие пригодности журнала', () => {
  it('одна и та же карточка при том же состоянии всегда получает тот же формат', () => {
    const card = { id: 'card-42', fsrs_reps: 9, fsrs_stability: 90 };
    const first = pickLadderFormat(card, 'fsrs', ALL).format;
    for (let i = 0; i < 50; i++) {
      expect(pickLadderFormat(card, 'fsrs', ALL).format).toBe(first);
    }
  });

  it('верхняя ступень разводит карточки между вводом и голосом, но устойчиво', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `card-${i}`);
    const formats = ids.map(
      (id) => pickLadderFormat({ id, fsrs_reps: 9, fsrs_stability: 90 }, 'fsrs', ALL).format
    );
    // Оба формата встречаются — голос не исчез из «Микса»…
    expect(new Set(formats)).toEqual(new Set(['type', 'voice']));
    // …но повтор даёт ровно тот же расклад.
    const again = ids.map(
      (id) => pickLadderFormat({ id, fsrs_reps: 9, fsrs_stability: 90 }, 'fsrs', ALL).format
    );
    expect(again).toEqual(formats);
  });

  it('сила следа возвращается вместе с форматом — уходит в журнал', () => {
    const pick = pickLadderFormat({ id: 'a', sm2_reps: 3, sm2_ivl: 9 }, 'sm2', ALL);
    expect(pick).toMatchObject({ rung: 'assisted', format: 'cloze', strength: 9 });
  });
});
