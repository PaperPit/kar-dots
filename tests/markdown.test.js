// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  escapeHtml, renderMarkdown, slugify, noteTitleFromBody, notePreview,
} from '../js/lib/markdown.ts';
import { buildNoteTitleIndex } from '../js/lib/note-links.ts';
import { tokenizeNotesText, buildNoteTermRows, rankNoteSearch } from '../js/lib/notes-fts.ts';

describe('markdown', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('renders headings with anchors', () => {
    const html = renderMarkdown('# Hello World\n\nparagraph');
    expect(html).toContain('<h1 id="hello-world">Hello World</h1>');
    expect(html).toContain('<p>paragraph</p>');
  });

  it('renders lists, bold, links', () => {
    const html = renderMarkdown('- **a**\n- [x](https://ex.com)');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>a</strong>');
    expect(html).toContain('href="https://ex.com"');
  });

  it('slugify keeps unicode letters', () => {
    expect(slugify('Привет мир!')).toBe('привет-мир');
  });

  it('title from first heading', () => {
    expect(noteTitleFromBody('# Title\nbody')).toBe('Title');
    expect(noteTitleFromBody('plain body here')).toMatch(/^plain body/);
  });

  it('preview strips markup', () => {
    expect(notePreview('## Head\n**bold** line')).toBe('Head');
  });
  it('renders blockquote and task list', () => {
    const html = renderMarkdown('> tip\n\n- [ ] todo\n- [x] done');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('class="md-task"');
    expect(html).toContain('checked');
  });

  it('renders GFM tables and strikethrough', () => {
    const html = renderMarkdown('| A | B |\n| --- | --- |\n| ~~old~~ | **new** |');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<del>old</del>');
    expect(html).toContain('<strong>new</strong>');
  });

  it('renders anchored wiki links', () => {
    const idx = buildNoteTitleIndex([{ id: 'n1', title: 'Other' }]);
    const html = renderMarkdown('see [[Other#My Heading|there]]', { wikiIndex: idx });
    expect(html).toContain('href="#note/n1#my-heading"');
    expect(html).toContain('>there</a>');
  });

  it('renders embed resolver placeholders', () => {
    const html = renderMarkdown('before ![[Other#part]] after', {
      embedResolver: (target, anchor) => `<span class="embed">${target}:${anchor}</span>`,
    });
    expect(html).toContain('<span class="embed">Other:part</span>');
  });
});

describe('notes-fts', () => {
  it('tokenizes latin and cyrillic', () => {
    expect(tokenizeNotesText('Hello мир world')).toEqual(['hello', 'мир', 'world']);
  });

  it('builds term rows', () => {
    const rows = buildNoteTermRows('n1', 'Cat', 'dog cat');
    expect(rows.map(r => r.term).sort()).toEqual(['cat', 'dog']);
    expect(rows.every(r => r.note_id === 'n1')).toBe(true);
  });

  it('ranks by hit count', () => {
    const byTerm = new Map([
      ['alpha', ['a', 'b']],
      ['beta', ['a']],
    ]);
    const ranked = rankNoteSearch(['alpha', 'beta'], byTerm);
    expect(ranked[0]).toEqual({ noteId: 'a', score: 2 });
    expect(ranked[1]).toEqual({ noteId: 'b', score: 1 });
  });
});
