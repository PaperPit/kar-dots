/** Windowed list inside a scroll container (.main) — only visible rows in DOM. */

const DEFAULT_OVERSCAN = 16
const DEFAULT_GAP = 10

/** Offset of list top from the top of scrollRoot content (px). */
export function getListOffset(scrollRoot: HTMLElement, root: HTMLElement) {
  const scrollRect = scrollRoot.getBoundingClientRect()
  const listRect = root.getBoundingClientRect()
  return scrollRoot.scrollTop + (listRect.top - scrollRect.top)
}

/** @returns {{ start: number, end: number, stride: number }} */
export interface VisibleRangeOpts {
  scrollTop: number
  viewportHeight: number
  listOffset: number
  totalItems: number
  rowHeight: number
  gap?: number
  overscan?: number
}

export function computeVisibleRange({
  scrollTop,
  viewportHeight,
  listOffset,
  totalItems,
  rowHeight,
  gap = DEFAULT_GAP,
  overscan = DEFAULT_OVERSCAN
}: VisibleRangeOpts) {
  const stride = rowHeight + gap
  const totalHeight = totalItems > 0 ? totalItems * stride - gap : 0

  if (!totalItems || totalHeight <= 0) {
    return { start: 0, end: 0, stride }
  }

  const viewTop = scrollTop
  const viewBottom = scrollTop + viewportHeight

  const visibleTop = Math.max(0, viewTop - listOffset)
  const visibleBottom = Math.min(totalHeight, viewBottom - listOffset)

  if (visibleBottom <= 0 || visibleTop >= totalHeight) {
    return { start: 0, end: 0, stride }
  }

  let start = Math.floor(visibleTop / stride) - overscan
  let end = Math.ceil(visibleBottom / stride) + overscan
  start = Math.max(0, start)
  end = Math.min(totalItems, end)
  if (end < start) end = start

  return { start, end, stride }
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.scrollRoot — usually `.main`
 * @param {HTMLElement} opts.mount — replaced by virtual list root
 * @param {Array} opts.items
 * @param {number} opts.rowHeight — row content height (gap separate)
 * @param {number} [opts.gap]
 * @param {(item: *, index: number) => HTMLElement} opts.renderRow
 */
export interface VirtualList {
  setItems(next: unknown[]): void
  refresh(): void
  destroy(): void
}

export interface VirtualListOpts<T> {
  scrollRoot: HTMLElement
  mount: HTMLElement
  items: T[]
  rowHeight: number
  gap?: number
  overscan?: number
  renderRow: (item: T, index: number) => HTMLElement
}

export function createVirtualList<T>({
  scrollRoot,
  mount,
  items,
  rowHeight,
  gap = DEFAULT_GAP,
  overscan = DEFAULT_OVERSCAN,
  renderRow
}: VirtualListOpts<T>): VirtualList {
  const root = document.createElement("div")
  root.className = "virtual-list card-list"
  const spacer = document.createElement("div")
  spacer.className = "virtual-list-spacer"
  spacer.setAttribute("aria-hidden", "true")
  const windowEl = document.createElement("div")
  windowEl.className = "virtual-list-window"
  root.append(spacer, windowEl)
  mount.replaceWith(root)

  let data = items
  let raf = 0
  let renderedStart = -1
  let renderedEnd = -1
  let renderedTranslate = -1
  const stride = rowHeight + gap

  function totalHeight() {
    if (!data.length) return 0
    return data.length * stride - gap
  }

  function paintWindow(start: number, end: number) {
    const translateY = start * stride
    if (start === renderedStart && end === renderedEnd && translateY === renderedTranslate) return

    renderedStart = start
    renderedEnd = end
    renderedTranslate = translateY

    if (end <= start) {
      windowEl.replaceChildren()
      windowEl.style.transform = ""
      return
    }

    windowEl.replaceChildren()
    windowEl.style.transform = `translate3d(0, ${translateY}px, 0)`
    for (let i = start; i < end; i++) {
      windowEl.append(renderRow(data[i]!, i))
    }
  }

  function render() {
    spacer.style.height = totalHeight() + "px"
    if (!data.length) {
      windowEl.replaceChildren()
      windowEl.style.transform = ""
      renderedStart = renderedEnd = -1
      renderedTranslate = -1
      return
    }

    const listOffset = getListOffset(scrollRoot, root)
    const range = computeVisibleRange({
      scrollTop: scrollRoot.scrollTop,
      viewportHeight: scrollRoot.clientHeight,
      listOffset,
      totalItems: data.length,
      rowHeight,
      gap,
      overscan
    })
    paintWindow(range.start, range.end)
  }

  function scheduleRender() {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      render()
    })
  }

  const onScroll = () => scheduleRender()
  scrollRoot.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll, { passive: true })

  scheduleRender()

  return {
    setItems(next: unknown[]) {
      data = next as T[]
      renderedStart = renderedEnd = -1
      renderedTranslate = -1
      scheduleRender()
    },
    refresh: scheduleRender,
    destroy() {
      scrollRoot.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }
}

/** Use virtual list when a flat DOM list would be heavy. */
export const VIRTUAL_LIST_THRESHOLD = 48
