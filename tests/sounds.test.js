import { describe, it, expect } from 'vitest';
import {
  SUCCESS_MELODIES, FAIL_MELODIES, CUP_MELODIES, UI_CLICK_MELODIES,
  normalizeSuccessSoundId, normalizeFailSoundId, normalizeAnswerSoundMode,
  normalizeCupMelodyId, normalizeUiClickSoundId,
  successSoundLabel, failSoundLabel, cupMelodyLabel, uiClickSoundLabel,
  playLessonCompleteSound,
} from '../js/lib/sounds.js';

describe('sounds', () => {
  it('5 MP3-мелодий для верного ответа', () => {
    expect(SUCCESS_MELODIES).toHaveLength(5);
    expect(SUCCESS_MELODIES.every(m => m.file.startsWith('audio/success/'))).toBe(true);
  });

  it('4 варианта кликов интерфейса', () => {
    expect(UI_CLICK_MELODIES).toHaveLength(4);
    expect(UI_CLICK_MELODIES[0].id).toBe('none');
    expect(UI_CLICK_MELODIES.filter(m => m.file).length).toBe(3);
  });

  it('normalizeUiClickSoundId', () => {
    expect(normalizeUiClickSoundId('click-soft')).toBe('click-soft');
    expect(normalizeUiClickSoundId('none')).toBe('none');
    expect(normalizeUiClickSoundId('bad')).toBe('none');
  });

  it('5 MP3-мелодий для кубка', () => {
    expect(CUP_MELODIES).toHaveLength(5);
    expect(CUP_MELODIES.every(m => m.file.startsWith('audio/'))).toBe(true);
  });

  it('5 MP3-мелодий для неверного ответа', () => {
    expect(FAIL_MELODIES).toHaveLength(5);
    expect(FAIL_MELODIES.every(m => m.file.startsWith('audio/fail/'))).toBe(true);
  });

  it('normalizeSuccessSoundId', () => {
    expect(normalizeSuccessSoundId('ui-pop')).toBe('ui-pop');
    expect(normalizeSuccessSoundId('chime')).toBe('confirm-tap');
    expect(normalizeSuccessSoundId('unknown')).toBe('confirm-tap');
  });

  it('normalizeFailSoundId', () => {
    expect(normalizeFailSoundId('short-fail')).toBe('short-fail');
    expect(normalizeFailSoundId('thud')).toBe('sword-cut');
    expect(normalizeFailSoundId('unknown')).toBe('load-fail');
  });

  it('normalizeAnswerSoundMode', () => {
    expect(normalizeAnswerSoundMode('both')).toBe('both');
    expect(normalizeAnswerSoundMode('correct')).toBe('correct');
    expect(normalizeAnswerSoundMode('wrong')).toBe('wrong');
    expect(normalizeAnswerSoundMode('none')).toBe('none');
    expect(normalizeAnswerSoundMode('bad')).toBe('both');
  });

  it('normalizeCupMelodyId', () => {
    expect(normalizeCupMelodyId('level-up')).toBe('level-up');
    expect(normalizeCupMelodyId('unknown')).toBe('show-alert');
  });

  it('labels', () => {
    expect(successSoundLabel('ui-pop')).toBe('UI pop');
    expect(successSoundLabel('confirm-tap')).toBe('Confirm tap');
    expect(failSoundLabel('short-fail')).toBe('Короткий сбой');
    expect(failSoundLabel('load-fail')).toBe('Сбой загрузки');
    expect(cupMelodyLabel('game-bonus')).toBe('Игровой бонус');
    expect(uiClickSoundLabel('click-crisp')).toBe('Чёткий клик');
  });

  it('playLessonCompleteSound — экспорт', () => {
    expect(typeof playLessonCompleteSound).toBe('function');
  });
});
