// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { createNoteEditor } from '../js/ui/editor.ts'
import { mountNotesGraphCanvas } from '../js/ui/notes-graph-canvas.ts'
import { filterEgoGraph, buildNoteGraph } from '../js/lib/note-links.ts'

describe('notes editor/graph smoke', () => {
  it('creates CM6 editor without throwing', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const ed = createNoteEditor({
      parent,
      doc: 'hello [[Other]] #tag',
      placeholder: 'Пишите заметку…',
      onCreateWikiNote: async () => {},
    })
    expect(ed.getValue()).toBe('hello [[Other]] #tag')
    expect(parent.querySelector('.cm-editor')).toBeTruthy()
    ed.insertAtCursor('\nmore')
    expect(ed.getValue()).toContain('more')
    ed.setLineNumbers(true)
    ed.setLineNumbers(false)
    ed.destroy()
  })

  it('mounts compact local graph for single-note ego', () => {
    const g = buildNoteGraph([{ id: 'a', title: 'A', body: 'x' }], [])
    const ego = filterEgoGraph(g, 'a', 1)
    expect(ego.nodes.map((n) => n.id)).toEqual(['a'])
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'clientWidth', { value: 640 })
    Object.defineProperty(parent, 'clientHeight', { value: 280 })
    parent.getBoundingClientRect = () => ({
      width: 640, height: 280, top: 0, left: 0, right: 640, bottom: 280, x: 0, y: 0, toJSON() {},
    })
    document.body.appendChild(parent)
    const h = mountNotesGraphCanvas({
      parent,
      nodes: ego.nodes,
      edges: ego.edges,
      compact: true,
    })
    const canvas = parent.querySelector('canvas')
    expect(canvas).toBeTruthy()
    expect(canvas.classList.contains('notes-graph-canvas--compact')).toBe(true)
    h.resize()
    // Не раздуваем canvas выше stage (280) — защита от RO feedback loop
    expect(canvas.height).toBeLessThanOrEqual(280 * (window.devicePixelRatio || 1) + 1)
    h.destroy()
    expect(parent.querySelector('canvas')).toBeNull()
  })
})

