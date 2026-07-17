import { describe, it, expect } from 'vitest';
import { buildHomeStats, folderStudyDue, todayStudyCount, boxStudyDue } from '../js/data/home-stats.js';

describe('buildHomeStats', () => {
  const now = 1_700_000_000_000;
  const cards = [
    { folder_id: 'fa', sm2_reps: 0, sm2_due: null },
    { folder_id: 'fa', sm2_reps: 2, sm2_due: now - 1000 },
    { folder_id: 'fb', sm2_reps: 0, sm2_due: null },
    { folder_id: 'fb', sm2_reps: 1, sm2_due: now - 500 },
  ];

  it('считает global и per-folder за один проход', () => {
    const stats = buildHomeStats(cards, 'sm2', now);
    expect(stats.totalCards).toBe(4);
    expect(stats.dueAll).toBe(2);
    expect(stats.newAllRaw).toBe(2);
    expect(stats.byFolder.fa).toEqual({ n: 2, due: 1, newRaw: 1 });
    expect(stats.byFolder.fb).toEqual({ n: 2, due: 1, newRaw: 1 });
  });

  it('folderStudyDue учитывает бюджет новых', () => {
    const row = { n: 5, due: 2, newRaw: 10 };
    expect(folderStudyDue(row, 3)).toBe(5);
    expect(folderStudyDue(null, 3)).toBe(0);
  });

  it('todayStudyCount = due + min(new, budget) — как бейдж и герой', () => {
    const stats = buildHomeStats(cards, 'sm2', now);
    expect(todayStudyCount(stats, 1)).toBe(3); // 2 due + 1 new
    expect(todayStudyCount(stats, 10)).toBe(4); // 2 due + 2 new
  });

  it('boxStudyDue не умножает бюджет на число папок', () => {
    const stats = buildHomeStats(cards, 'sm2', now);
    // per-folder min(new,1) дало бы 1+1=2 new; общий бюджет — 1 new
    expect(boxStudyDue(stats, ['fa', 'fb'], 1)).toBe(3); // 2 due + 1 new
    expect(boxStudyDue(stats, ['fa', 'fb'], 10)).toBe(4);
  });

  it('dueTomorrowAll — карточки с due завтра', () => {
    const tomorrow = now + 86_400_000;
    const cards = [
      { folder_id: 'fa', sm2_reps: 1, sm2_due: tomorrow + 3_600_000 },
      { folder_id: 'fa', sm2_reps: 2, sm2_due: now - 1000 },
    ];
    const stats = buildHomeStats(cards, 'sm2', now);
    expect(stats.dueTomorrowAll).toBe(1);
    expect(stats.dueAll).toBe(1);
  });
});
