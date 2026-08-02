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

  it('mounts compact local graph with fixed layout height', () => {
    const g = buildNoteGraph([{ id: 'a', title: 'A', body: 'x' }], [])
    const ego = filterEgoGraph(g, 'a', 1)
    expect(ego.nodes.map((n) => n.id)).toEqual(['a'])
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'clientWidth', { value: 640, configurable: true })
    Object.defineProperty(parent, 'clientHeight', { value: 280, configurable: true, writable: true })
    let rectH = 280
    parent.getBoundingClientRect = () => ({
      width: 640, height: rectH, top: 0, left: 0, right: 640, bottom: rectH, x: 0, y: 0, toJSON() {},
    })
    document.body.appendChild(parent)

    // happy-dom часто без 2d — мокаем, чтобы отработал resize, не stub.
    const proto = HTMLCanvasElement.prototype
    const prev = proto.getContext
    proto.getContext = function getContext() {
      return new Proxy(
        {},
        {
          get: () => () => {},
          set: () => true,
        }
      )
    }

    try {
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
      expect(canvas.style.height).toBe('280px')
      expect(canvas.style.width).toBe('640px')
      expect(canvas.height).toBe(Math.round(280 * (window.devicePixelRatio || 1)))
      // Повторный resize не раздувает высоту даже если parent «вырос»
      rectH = 900
      Object.defineProperty(parent, 'clientHeight', { value: 900, configurable: true })
      h.resize()
      expect(canvas.style.height).toBe('280px')
      expect(canvas.height).toBe(Math.round(280 * (window.devicePixelRatio || 1)))
      h.destroy()
      expect(parent.querySelector('canvas')).toBeNull()
    } finally {
      proto.getContext = prev
    }
  })
})

