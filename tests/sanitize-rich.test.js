// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { sanitizeRich } from '../js/ui/ui.ts';

describe('sanitizeRich formatting', () => {
  it('keeps underline and highlight marks', () => {
    const html = '<u>see</u> <mark class="rich-hl-green">A1</mark>';
    expect(sanitizeRich(html)).toBe('<u>see</u> <mark class="rich-hl-green">A1</mark>');
  });

  it('strips unknown highlight classes', () => {
    expect(sanitizeRich('<mark class="rich-hl-green evil">x</mark>')).toBe('<mark class="rich-hl-green">x</mark>');
    expect(sanitizeRich('<mark class="bad">x</mark>')).toBe('x');
  });
});
