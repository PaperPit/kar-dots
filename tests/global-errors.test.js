// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const toastAction = vi.fn()

vi.mock('../js/ui/ui.ts', async () => {
  const actual = await vi.importActual('../js/ui/ui.ts')
  return { ...actual, toastAction }
})

describe('global-errors', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toasts"></div>'
    toastAction.mockClear()
    vi.resetModules()
  })

  it('ignores ResizeObserver loop noise', async () => {
    const { initGlobalErrors } = await import('../js/ui/global-errors.ts')
    initGlobalErrors()
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'ResizeObserver loop completed with undelivered notifications.',
        error: new Error('ResizeObserver loop completed with undelivered notifications.'),
      })
    )
    expect(toastAction).not.toHaveBeenCalled()
  })
})
