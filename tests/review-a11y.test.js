// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { showStudyFeedback } from '../js/ui/answer-feedback.ts';
import { createFlipCard } from '../js/screens/review/flip-card.ts';

describe('review a11y', () => {
  it('showStudyFeedback sets assertive live region for wrong answers', () => {
    const box = document.createElement('div');
    showStudyFeedback(box, false, 'Wrong');
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('assertive');
    expect(box.getAttribute('aria-atomic')).toBe('true');
  });

  it('showStudyFeedback uses polite live region for correct answers', () => {
    const box = document.createElement('div');
    showStudyFeedback(box, true, 'OK');
    expect(box.getAttribute('aria-live')).toBe('polite');
  });

  it('flip card grade row is a labelled group', () => {
    const card = { id: 'c1', front: 'a', back: 'b' };
    const ui = createFlipCard(card, 'front');
    expect(ui.grades.getAttribute('role')).toBe('group');
    expect(ui.grades.getAttribute('aria-label')).toBeTruthy();
    ui.destroy();
  });
});
