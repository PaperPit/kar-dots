// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  nearestHeadingAnchor,
  selectionToCardPayload,
} from '../js/screens/note/selection-to-card.ts'

describe('selection-to-card', () => {
  it('finds nearest heading anchor above cursor', () => {
    const body = '# Intro\n\ntext\n\n## Details section\n\nmore text'
    const pos = body.indexOf('more text')
    expect(nearestHeadingAnchor(body, pos)).toBe('details-section')
  })

  it('returns null when no heading above', () => {
    expect(nearestHeadingAnchor('plain\ntext', 5)).toBe(null)
  })

  it('builds card payload from selection', () => {
    const body = '# Alpha\n\nhello world'
    const payload = selectionToCardPayload({
      selection: '  hello world  ',
      noteId: 'n1',
      body,
      cursorPos: body.indexOf('hello'),
      folderId: 'f1',
    })
    expect(payload).toEqual({
      front: 'hello world',
      back: '',
      folder_id: 'f1',
      note_id: 'n1',
      note_anchor: 'alpha',
    })
  })
})
