// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { pastePlainHtml } from '../js/ui/rich-editor.ts';

describe('pastePlainHtml', () => {
  it('escapes markup from the clipboard', () => {
    expect(pastePlainHtml('<b>hi</b>')).toBe('&lt;b&gt;hi&lt;/b&gt;');
    expect(pastePlainHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(pastePlainHtml('a & b')).toBe('a &amp; b');
    expect(pastePlainHtml(`"q" 'q'`)).toBe('&quot;q&quot; &#39;q&#39;');
  });

  it('turns newlines into <br>, normalising CRLF', () => {
    expect(pastePlainHtml('one\ntwo')).toBe('one<br>two');
    expect(pastePlainHtml('one\r\ntwo')).toBe('one<br>two');
    expect(pastePlainHtml('one\rtwo')).toBe('one<br>two');
    expect(pastePlainHtml('a\n\nb')).toBe('a<br><br>b');
  });

  it('keeps plain text untouched', () => {
    expect(pastePlainHtml('обычный текст')).toBe('обычный текст');
  });

  it('returns an empty string for empty input', () => {
    expect(pastePlainHtml('')).toBe('');
    expect(pastePlainHtml(null)).toBe('');
    expect(pastePlainHtml(undefined)).toBe('');
  });

  it('produces no tags other than <br>', () => {
    const html = pastePlainHtml('<script>alert(1)</script>\n<a href="#">x</a>');
    expect(html.replace(/<br>/g, '')).not.toMatch(/[<>]/);
  });
});
