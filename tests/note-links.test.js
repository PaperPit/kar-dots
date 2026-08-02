// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  extractHashtags,
  extractWikiLinks,
  buildNoteTitleIndex,
  resolveWikiTarget,
  buildNoteGraph,
  findBacklinks,
} from '../js/lib/note-links.ts'
import { renderMarkdown } from '../js/lib/markdown.ts'

describe('note-links', () => {
  it('extracts hashtags but not headings', () => {
    expect(extractHashtags('# Title\nhello #idea and #idea again #учёба')).toEqual([
      'idea',
      'учёба',
    ])
  })

  it('extracts wiki links with labels', () => {
    expect(extractWikiLinks('see [[Alpha]] and [[Beta|B]]')).toEqual([
      { target: 'Alpha', label: 'Alpha', raw: '[[Alpha]]' },
      { target: 'Beta', label: 'B', raw: '[[Beta|B]]' },
    ])
  })

  it('resolves titles case-insensitively', () => {
    const idx = buildNoteTitleIndex([
      { id: '1', title: 'Alpha Note' },
      { id: '2', title: 'Beta' },
    ])
    expect(resolveWikiTarget('alpha note', idx)).toBe('1')
    expect(resolveWikiTarget('2', idx)).toBe('2')
  })

  it('builds graph with folder and wiki edges', () => {
    const g = buildNoteGraph(
      [
        { id: 'a', title: 'A', body: 'see [[B]]', folder_id: 'f1', tags: ['x'] },
        { id: 'b', title: 'B', body: '', folder_id: null },
      ],
      [{ id: 'f1', name: 'Folder' }]
    )
    expect(g.nodes.some((n) => n.id === 'folder:f1' && n.kind === 'folder')).toBe(true)
    expect(g.edges).toEqual(
      expect.arrayContaining([
        { from: 'a', to: 'b', kind: 'wiki' },
        { from: 'a', to: 'folder:f1', kind: 'folder' },
      ])
    )
  })

  it('finds backlinks', () => {
    const bl = findBacklinks('b', 'Beta', [
      { id: 'a', title: 'A', body: 'link [[Beta]]' },
      { id: 'b', title: 'Beta', body: '' },
    ])
    expect(bl).toEqual([{ id: 'a', title: 'A' }])
  })
})

describe('markdown wiki/image/tag', () => {
  it('renders wiki, image with caption, and tag', () => {
    const idx = buildNoteTitleIndex([{ id: 'n1', title: 'Other' }])
    const html = renderMarkdown('see [[Other]] #focus\n\n![cat](https://ex.com/a.png)', {
      wikiIndex: idx,
    })
    expect(html).toContain('href="#note/n1"')
    expect(html).toContain('class="md-tag"')
    expect(html).toContain('href="#notes/tag/focus"')
    expect(html).toContain('<img src="https://ex.com/a.png" alt="cat"')
    expect(html).toContain('md-figcaption')
  })
})
