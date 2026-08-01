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

describe('sanitizeRich XSS', () => {
  it('strips script tags and keeps text', () => {
    const out = sanitizeRich('<b>ok</b><script>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('<b>ok</b>');
    expect(out).toContain('alert(1)');
  });

  it('strips event-handler attributes via tag allowlist', () => {
    const out = sanitizeRich('<img src=x onerror=alert(1)><b onclick="evil()">x</b>');
    expect(out).not.toMatch(/onerror|onclick|img/i);
    expect(out).toBe('<b>x</b>');
  });

  it('blocks javascript: and data: hrefs', () => {
    expect(sanitizeRich('<a href="javascript:alert(1)">x</a>')).toBe('x');
    expect(sanitizeRich('<a href="data:text/html,hi">x</a>')).toBe('x');
    expect(sanitizeRich('<a href="https://example.com">x</a>')).toContain('https://example.com');
  });

  it('strips svg wrappers (DOMParser may drop sibling text; no svg/script left)', () => {
    const out = sanitizeRich('<div><svg onload=alert(1)></svg><b>safe</b></div>');
    expect(out).not.toMatch(/<svg|onload|script/i);
    expect(out).toContain('safe');
  });
});
