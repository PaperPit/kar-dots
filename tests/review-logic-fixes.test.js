// @vitest-environment happy-dom
/**
 * Регрессии на логические ошибки режимов повторения (аудит, август 2026).
 * Каждый тест падал бы до правки — это его единственная задача.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock поднимается наверх файла — переменные для моков объявляем через
// vi.hoisted, иначе они ещё не инициализированы к моменту вызова фабрики.
const { updateCard, recordReview, logReview } = vi.hoisted(() => ({
  updateCard: vi.fn(async () => true),
  recordReview: vi.fn(async () => {}),
  logReview: vi.fn(async () => 'log-1'),
}));

vi.mock('../js/core/state.js', () => ({
  store: {
    settings: { leitnerIntervals: [1, 2, 4, 8, 16] },
    updateCard,
  },
}));

vi.mock('../js/lib/activity.js', () => ({
  recordReview,
  undoReview: vi.fn(async () => {}),
}));

vi.mock('../js/lib/review-log.js', () => ({
  buildReviewEntry: vi.fn(() => ({})),
  logReview,
  removeReview: vi.fn(async () => {}),
}));

vi.mock('../js/ui/helpers.js', () => ({
  spendNewBudget: vi.fn(),
  refundNewBudget: vi.fn(),
}));

vi.mock('../js/lib/sounds.js', () => ({
  playAnswerFeedback: vi.fn(),
  unlockAnswerAudio: vi.fn(),
}));

import {
  applyGrade,
  submitGrade,
  gradePayload,
  gradeMatchResults,
  recordFirstTry,
  checkedAnswerPayload,
} from '../js/screens/review/grading.ts';
import { pickMatchBatch } from '../js/screens/review/modes/match.ts';
import { computeLessonStars } from '../js/lib/lesson-stars.ts';

function card(id, extra = {}) {
  return { id, front: 'f' + id, back: 'b' + id, sm2_reps: 1, sm2_due: 1, sm2_ef: 2.5, sm2_ivl: 3, ...extra };
}

function makeCtx(queue, over = {}) {
  return {
    algo: 'sm2',
    answered: 0,
    cram: false,
    currentBox: null,
    currentIsNew: false,
    currentSwipeWrap: null,
    done: 0,
    grading: false,
    pendingUndo: null,
    queue: queue.slice(),
    sessionFirstTry: new Set(),
    showNext: vi.fn(),
    showNextTimer: null,
    stage: document.createElement('div'),
    stats: { attempted: 0, firstTryOk: 0, known: 0, failed: 0 },
    trackFlipFirstTry: vi.fn(() => false),
    undoHoldUntilFlip: false,
    undoToastDismiss: null,
    updateBar: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  updateCard.mockClear();
  recordReview.mockClear();
  logReview.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('#1 верный ответ со второй попытки — промах, а не успех', () => {
  it('checkedAnswerPayload: первая попытка → успех, вторая → Again/q=0', () => {
    expect(checkedAnswerPayload('sm2', true)).toEqual({ q: 4 });
    expect(checkedAnswerPayload('sm2', false)).toEqual({ q: 0 });
    expect(checkedAnswerPayload('fsrs', true)).toEqual({ fsrs: 3 }); // Good
    expect(checkedAnswerPayload('fsrs', false)).toEqual({ fsrs: 1 }); // Again
    expect(checkedAnswerPayload('leitner', true)).toEqual({ leitner: true });
    expect(checkedAnswerPayload('leitner', false)).toEqual({ leitner: false });
  });

  it('промах со второй попытки возвращает карточку в очередь и не двигает done', async () => {
    const ctx = makeCtx([card('1'), card('2'), card('3')]);
    // Пользователь ошибся, увидел «Неверно», исправился: firstTry = false.
    await applyGrade(ctx, ctx.queue[0], checkedAnswerPayload('sm2', false), {
      quiet: true, skipAdvance: true,
    });
    expect(ctx.queue.map(c => c.id)).toEqual(['2', '3', '1']);
    expect(ctx.done).toBe(0);
    expect(ctx.stats.failed).toBe(1);
    // Интервал сброшен, а не умножен: карточка вернётся через 10 минут.
    expect(updateCard.mock.calls[0][1].sm2_reps).toBe(0);
  });
});

describe('#4a итоги сессии считаются и при skipProgress (раунд пар в «Миксе»)', () => {
  it('stats.known/failed растут независимо от полосы прогресса', async () => {
    const ctx = makeCtx([card('1'), card('2')]);
    await applyGrade(ctx, ctx.queue[0], gradePayload('sm2', true), {
      quiet: true, skipProgress: true, skipAdvance: true,
    });
    // Раньше при skipProgress статистика не двигалась вовсе — финиш «Микса»
    // показывал «Знаю 0 / Повторить 0».
    expect(ctx.stats.known).toBe(1);
    expect(ctx.answered).toBe(0); // полосу ведёт вызывающий код
  });
});

describe('#4b звёзды за «Микс»', () => {
  it('безупречный раунд пар даёт полный firstTryOk по карточкам', async () => {
    const cards = ['1', '2', '3', '4', '5'].map(id => card(id));
    const ctx = makeCtx(cards);
    await gradeMatchResults(ctx, cards.map(c => ({ card: c, know: true })), { countAsOne: true });
    // Раньше countAsOne давал +1 за весь раунд из пяти карточек, а звёзды
    // делятся на число карточек сессии — три звезды были недостижимы.
    expect(ctx.stats.firstTryOk).toBe(5);
    expect(computeLessonStars({ stats: ctx.stats, sessionCards: 5 })).toBe(3);
  });
});

describe('#7 попытка засчитывается один раз за сессию', () => {
  it('повторный показ проваленной карточки не наращивает attempted/firstTryOk', () => {
    const ctx = makeCtx([]);
    expect(recordFirstTry(ctx, 'a', false)).toBe(true);
    expect(recordFirstTry(ctx, 'a', true)).toBe(false); // вернулась после промаха
    expect(ctx.stats.attempted).toBe(1);
    expect(ctx.stats.firstTryOk).toBe(0);
  });
});

describe('#5 закрепление не трогает расписание и дневной лимит', () => {
  it('cram: без updateCard, без журнала, recordReview помечен cram', async () => {
    const ctx = makeCtx([card('1')], { cram: true });
    await applyGrade(ctx, ctx.queue[0], gradePayload('sm2', true), { quiet: true, skipAdvance: true });
    expect(updateCard).not.toHaveBeenCalled();
    expect(logReview).not.toHaveBeenCalled();
    expect(recordReview).toHaveBeenCalledWith(1, { known: 1 }, { cram: true });
  });

  it('обычная сессия по-прежнему пишет карточку и журнал', async () => {
    const ctx = makeCtx([card('1')]);
    await applyGrade(ctx, ctx.queue[0], gradePayload('sm2', true), { quiet: true, skipAdvance: true });
    expect(updateCard).toHaveBeenCalled();
    expect(logReview).toHaveBeenCalled();
    expect(recordReview).toHaveBeenCalledWith(1, { known: 1 }, { cram: false });
  });
});

describe('#2 блокировка грейда держится до показа следующей карточки', () => {
  it('второй грейд в окне до showNext не проходит и не съедает карточку', async () => {
    const ctx = makeCtx([card('1'), card('2'), card('3')]);
    const first = ctx.queue[0];

    submitGrade(ctx, first, gradePayload('sm2', true), null, { quiet: true });
    // Запись в хранилище уже завершилась, но следующая карточка монтируется
    // только через 240 мс — старая ещё в DOM со своим обработчиком клавиш.
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.grading).toBe(true);

    // Повторное нажатие в этом окне (клавишами CSS не блокируется).
    submitGrade(ctx, first, gradePayload('sm2', true), null, { quiet: true });
    await vi.advanceTimersByTimeAsync(0);

    // Раньше второй грейд проходил и ctx.queue.shift() выбрасывал карточку 2,
    // которую пользователь так и не увидел.
    expect(ctx.queue.map(c => c.id)).toEqual(['2', '3']);
    expect(ctx.answered).toBe(1);
    expect(ctx.stats.known).toBe(1);
  });
});

describe('#8 раунд пар не собирает неразличимые кнопки', () => {
  it('карточки с одинаковым текстом ответа не попадают в один батч', () => {
    const cards = [
      card('1', { front: 'кот', back: 'cat' }),
      card('2', { front: 'кошка', back: 'cat' }),
      card('3', { front: 'пёс', back: 'dog' }),
      card('4', { front: 'дом', back: 'house' }),
    ];
    const { batch } = pickMatchBatch(cards, 2, 4, 'front');
    const answers = batch.map(c => c.back);
    expect(new Set(answers).size).toBe(answers.length);
    expect(batch.map(c => c.id)).toEqual(['1', '3', '4']);
  });

  it('совпадение по вопросу тоже разводится по разным раундам', () => {
    const cards = [
      card('1', { front: 'bank', back: 'банк' }),
      card('2', { front: 'bank', back: 'берег' }),
      card('3', { front: 'sun', back: 'солнце' }),
    ];
    const { batch } = pickMatchBatch(cards, 2, 4, 'front');
    expect(batch.map(c => c.id)).toEqual(['1', '3']);
  });
});
