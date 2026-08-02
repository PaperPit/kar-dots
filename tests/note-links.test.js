// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  extractHashtags,
  extractWikiLinks,
  extractEmbeds,
  buildNoteTitleIndex,
  resolveWikiTarget,
  buildNoteGraph,
  findBacklinks,
  findUnlinkedMentions,
  linkFirstUnlinkedMention,
  rewriteWikiLinks,
  countWikiLinksToTitle,
  filterEgoGraph,
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
    expect(extractWikiLinks('see [[Alpha]] and [[Beta|B]] and [[Gamma#part|G]]')).toEqual([
      { target: 'Alpha', label: 'Alpha', raw: '[[Alpha]]' },
      { target: 'Beta', label: 'B', raw: '[[Beta|B]]' },
      { target: 'Gamma', anchor: 'part', label: 'G', raw: '[[Gamma#part|G]]' },
    ])
  })

  it('resolves titles case-insensitively', () => {
    const idx = buildNoteTitleIndex([
      { id: '1', title: 'Alpha Note' },
      { id: '2', title: 'Beta' },
    ])
    expect(resolveWikiTarget('alpha note', idx)).toBe('1')
    expect(resolveWikiTarget('Alpha Note#details', idx)).toBe('1')
    expect(resolveWikiTarget('2', idx)).toBe('2')
  })

  it('builds graph with folder and wiki edges', () => {
    const g = buildNoteGraph(
      [
        { id: 'a', title: 'A', body: 'see [[B#intro]]', folder_id: 'f1', tags: ['x'] },
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
      { id: 'a', title: 'A', body: 'one\ntwo\nlink [[Beta#part]]\nafter\nmore\nlast' },
      { id: 'b', title: 'Beta', body: '' },
    ])
    expect(bl).toEqual([{
      id: 'a',
      title: 'A',
      snippets: [{
        before: 'one\ntwo',
        match: '[[Beta#part]]',
        after: 'after\nmore',
      }],
    }])
  })

  it('finds unlinked mentions outside wiki links and fences', () => {
    const refs = findUnlinkedMentions('Alpha Note', [
      { id: 'a', title: 'A', body: 'Alpha Note\n[[Alpha Note]]\n```\nAlpha Note\n```\nAlpha Notebook' },
      { id: 'b', title: 'Alpha Note', body: 'self Alpha Note' },
    ], 'b')
    expect(refs).toHaveLength(1)
    expect(refs[0].snippets[0].match).toBe('Alpha Note')
    expect(refs[0].snippets).toHaveLength(1)
  })

  it('links first unlinked mention without touching wiki or fences', () => {
    const body = 'see [[Alpha Note]] then Alpha Note and ```\nAlpha Note\n```'
    expect(linkFirstUnlinkedMention(body, 'Alpha Note')).toBe(
      'see [[Alpha Note]] then [[Alpha Note]] and ```\nAlpha Note\n```'
    )
  })

  it('skips embeds in extractWikiLinks but keeps them via extractEmbeds', () => {
    expect(extractWikiLinks('see [[Alpha]] and ![[Beta]]')).toEqual([
      { target: 'Alpha', label: 'Alpha', raw: '[[Alpha]]' },
    ])
    expect(extractEmbeds('see [[Alpha]] and ![[Beta]]')).toEqual([
      { target: 'Beta', raw: '![[Beta]]' },
    ])
  })

  it('counts wiki links including embeds for rename dialogs', () => {
    expect(countWikiLinksToTitle('[[Old]] ![[Old#a]] [[Other]]', 'Old')).toBe(2)
  })

  it('rewrites wiki links for renamed titles', () => {
    const body = '[[Old]] [[Old|label]] [[Old#a]] [[Old#a|label]] [[Other Old]]'
    expect(rewriteWikiLinks(body, 'Old', 'New')).toBe(
      '[[New]] [[New|label]] [[New#a]] [[New#a|label]] [[Other Old]]'
    )
  })

  it('extracts embeds with anchors', () => {
    expect(extractEmbeds('![[Alpha]] and ![[Beta#part]]')).toEqual([
      { target: 'Alpha', raw: '![[Alpha]]' },
      { target: 'Beta', anchor: 'part', raw: '![[Beta#part]]' },
    ])
  })

  it('filters ego graph by undirected depth', () => {
    const graph = {
      nodes: [
        { id: 'a', title: 'A', kind: 'note' },
        { id: 'b', title: 'B', kind: 'note' },
        { id: 'c', title: 'C', kind: 'note' },
        { id: 'd', title: 'D', kind: 'note' },
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'wiki' },
        { from: 'c', to: 'b', kind: 'wiki' },
        { from: 'c', to: 'd', kind: 'wiki' },
      ],
    }
    const ego = filterEgoGraph(graph, 'a', 2)
    expect(ego.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
    expect(ego.edges).toEqual(expect.arrayContaining([
      { from: 'a', to: 'b', kind: 'wiki' },
      { from: 'c', to: 'b', kind: 'wiki' },
    ]))
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
