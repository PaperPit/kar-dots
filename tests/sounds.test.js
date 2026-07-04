import { describe, it, expect } from 'vitest';
import {
  SUCCESS_MELODIES, FAIL_MELODIES,
  normalizeSuccessSoundId, normalizeFailSoundId, normalizeAnswerSoundMode,
  successSoundLabel, failSoundLabel,
} from '../js/lib/sounds.js';

describe('sounds', () => {
  it('5 мелодий для верного и неверного ответа', () => {
    expect(SUCCESS_MELODIES).toHaveLength(5);
    expect(FAIL_MELODIES).toHaveLength(5);
  });

  it('normalizeSuccessSoundId', () => {
    expect(normalizeSuccessSoundId('fanfare')).toBe('fanfare');
    expect(normalizeSuccessSoundId('unknown')).toBe('chime');
  });

  it('normalizeFailSoundId', () => {
    expect(normalizeFailSoundId('thud')).toBe('thud');
    expect(normalizeFailSoundId('unknown')).toBe('drop');
  });

  it('normalizeAnswerSoundMode', () => {
    expect(normalizeAnswerSoundMode('both')).toBe('both');
    expect(normalizeAnswerSoundMode('correct')).toBe('correct');
    expect(normalizeAnswerSoundMode('wrong')).toBe('wrong');
    expect(normalizeAnswerSoundMode('none')).toBe('none');
    expect(normalizeAnswerSoundMode('bad')).toBe('both');
  });

  it('labels', () => {
    expect(successSoundLabel('pop')).toBe('Щелчок');
    expect(successSoundLabel('chime')).toBe('Динь');
    expect(failSoundLabel('buzz')).toBe('Брр');
    expect(failSoundLabel('drop')).toBe('Спад');
  });
});
