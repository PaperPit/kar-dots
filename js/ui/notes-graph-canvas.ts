import { layoutNoteGraph, nodeDegrees, type LayoutNode } from "../lib/note-graph-layout.js"

export type GraphCanvasOpts = {
  parent: HTMLElement
  nodes: { id: string; title: string; kind: "note" | "folder" }[]
  edges: { from: string; to: string; kind: "wiki" | "folder" }[]
  compact?: boolean
  onNodeClick?: (id: string, kind: string) => void
}

export type GraphCanvasHandle = { destroy(): void; resize(): void }

type PointerMode = "pan" | "node" | null

type GraphColors = {
  ink: string
  paper: string
  petrol: string
  ash: string
}

export function mountNotesGraphCanvas(opts: GraphCanvasOpts): GraphCanvasHandle {
  const fixedHeight = opts.compact ? 280 : 420
  const canvas = document.createElement("canvas")
  canvas.className = "notes-graph-canvas" + (opts.compact ? " notes-graph-canvas--compact" : "")
  canvas.tabIndex = 0
  canvas.setAttribute("role", "img")
  opts.parent.appendChild(canvas)

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return {
      destroy: () => canvas.remove(),
      resize: () => {},
    }
  }

  const cssWidth = Math.max(320, opts.parent.clientWidth || opts.parent.getBoundingClientRect().width || 640)
  const laid = layoutNoteGraph(opts.nodes, opts.edges, cssWidth, fixedHeight, opts.compact ? 55 : 80)
  const nodes = laid.nodes
  const edges = laid.edges
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const degrees = nodeDegrees(edges)
  const neighbors = new Map<string, Set<string>>()
  for (const n of nodes) neighbors.set(n.id, new Set())
  for (const e of edges) {
    neighbors.get(e.from)?.add(e.to)
    neighbors.get(e.to)?.add(e.from)
  }

  let dpr = 1
  let width = cssWidth
  let height = fixedHeight
  let scale = 1
  let panX = 0
  let panY = 0
  let hovered: string | null = null
  let mode: PointerMode = null
  let activePointerId: number | null = null
  let dragNode: LayoutNode | null = null
  let startClientX = 0
  let startClientY = 0
  let lastClientX = 0
  let lastClientY = 0
  let dragged = false

  const colors = readColors(opts.parent)

  const resize = () => {
    const rect = opts.parent.getBoundingClientRect()
    // Ширина/высота — строго из CSS-бокса родителя (stage с фиксированной height).
    // Не задаём canvas.style.height в px: иначе parent растёт → RO loop.
    const nextW = Math.max(1, Math.floor(rect.width || opts.parent.clientWidth || cssWidth))
    const measuredH = Math.floor(rect.height || opts.parent.clientHeight || 0)
    const nextH = measuredH >= 2 ? measuredH : fixedHeight
    const nextDpr = Math.max(1, window.devicePixelRatio || 1)
    if (
      nextW === width &&
      nextH === height &&
      nextDpr === dpr &&
      canvas.width === Math.round(width * dpr)
    ) {
      return
    }
    width = nextW
    height = nextH
    dpr = nextDpr
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    draw()
  }

  let resizeRaf = 0
  const scheduleResize = () => {
    if (resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      resize()
    })
  }

  const screenToWorld = (x: number, y: number) => ({ x: (x - panX) / scale, y: (y - panY) / scale })
  const nodeRadius = (id: string) => 4 + 4 * Math.log(1 + (degrees.get(id) || 0))

  const folderBox = (n: LayoutNode) => {
    const compact = !!opts.compact
    const w = Math.max(compact ? 58 : 72, Math.min(compact ? 104 : 140, 22 + n.title.length * 5.5))
    const h = compact ? 24 : 30
    return { x: n.x - w / 2, y: n.y - h / 2, w, h, r: compact ? 5 : 7 }
  }

  const hitNode = (x: number, y: number): LayoutNode | null => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]!
      if (n.kind === "folder") {
        const b = folderBox(n)
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return n
      } else {
        const r = Math.max(8, nodeRadius(n.id) + 4)
        const dx = x - n.x
        const dy = y - n.y
        if (dx * dx + dy * dy <= r * r) return n
      }
    }
    return null
  }

  const eventPoint = (ev: PointerEvent | WheelEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
  }

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = colors.paper
    ctx.fillRect(0, 0, width, height)

    const hotNeighbors = hovered ? neighbors.get(hovered) || new Set<string>() : null
    const isHotNode = (id: string) => !hovered || id === hovered || !!hotNeighbors?.has(id)
    const isHotEdge = (e: { from: string; to: string }) => !hovered || e.from === hovered || e.to === hovered

    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(scale, scale)

    for (const e of edges) {
      const a = byId.get(e.from)
      const b = byId.get(e.to)
      if (!a || !b) continue
      const hot = isHotEdge(e)
      ctx.globalAlpha = hot ? 0.85 : 0.16
      ctx.strokeStyle = e.kind === "wiki" ? colors.petrol : colors.ash
      ctx.lineWidth = (hot ? 1.8 : 1.2) / scale
      if (e.kind === "folder") ctx.setLineDash([5 / scale, 4 / scale])
      else ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    for (const n of nodes) {
      const degree = degrees.get(n.id) || 0
      const hot = isHotNode(n.id)
      ctx.globalAlpha = hot ? 1 : 0.26
      if (n.kind === "folder") {
        const b = folderBox(n)
        roundedRect(ctx, b.x, b.y, b.w, b.h, b.r)
        ctx.fillStyle = colors.ash
        ctx.fill()
        ctx.strokeStyle = hot ? colors.petrol : colors.ink
        ctx.lineWidth = 1.4 / scale
        ctx.stroke()
      } else {
        const r = nodeRadius(n.id)
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = degree === 0 ? colors.ash : hot && hovered === n.id ? colors.petrol : colors.ink
        ctx.fill()
        ctx.strokeStyle = colors.paper
        ctx.lineWidth = 2 / scale
        ctx.stroke()
      }
    }

    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.font = `${opts.compact ? 10 : 11}px sans-serif`
    for (const n of nodes) {
      if (!isHotNode(n.id)) continue
      ctx.globalAlpha = hovered && n.id !== hovered && !hotNeighbors?.has(n.id) ? 0.35 : 0.92
      ctx.fillStyle = colors.ink
      const label = (n.title || "Untitled").slice(0, opts.compact ? 20 : 28)
      ctx.fillText(label, n.x, n.y + (n.kind === "folder" ? 18 : nodeRadius(n.id) + 8))
    }

    ctx.restore()
    ctx.globalAlpha = 1
  }

  const onPointerDown = (ev: PointerEvent) => {
    const p = eventPoint(ev)
    const w = screenToWorld(p.x, p.y)
    const n = hitNode(w.x, w.y)
    mode = n ? "node" : "pan"
    dragNode = n
    activePointerId = ev.pointerId
    startClientX = ev.clientX
    startClientY = ev.clientY
    lastClientX = ev.clientX
    lastClientY = ev.clientY
    dragged = false
    canvas.setPointerCapture(ev.pointerId)
    ev.preventDefault()
  }

  const onPointerMove = (ev: PointerEvent) => {
    const p = eventPoint(ev)
    const w = screenToWorld(p.x, p.y)
    if (activePointerId === ev.pointerId && mode) {
      const dx = ev.clientX - lastClientX
      const dy = ev.clientY - lastClientY
      if (Math.abs(ev.clientX - startClientX) + Math.abs(ev.clientY - startClientY) > 4) dragged = true
      if (mode === "node" && dragNode) {
        dragNode.x += dx / scale
        dragNode.y += dy / scale
      } else {
        panX += dx
        panY += dy
      }
      lastClientX = ev.clientX
      lastClientY = ev.clientY
      draw()
      return
    }

    const hit = hitNode(w.x, w.y)
    const nextHover = hit?.id || null
    if (nextHover !== hovered) {
      hovered = nextHover
      canvas.style.cursor = hit ? "grab" : "grab"
      draw()
    }
  }

  const onPointerUp = (ev: PointerEvent) => {
    const clicked = dragNode && !dragged
    if (activePointerId === ev.pointerId) {
      try {
        canvas.releasePointerCapture(ev.pointerId)
      } catch {
        // Pointer capture may already be gone after browser gestures.
      }
    }
    const node = dragNode
    mode = null
    activePointerId = null
    dragNode = null
    if (clicked && node) opts.onNodeClick?.(node.id, node.kind)
  }

  const onPointerLeave = () => {
    if (mode) return
    if (hovered) {
      hovered = null
      draw()
    }
  }

  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault()
    const p = eventPoint(ev)
    const before = screenToWorld(p.x, p.y)
    const factor = Math.exp(-ev.deltaY * 0.001)
    scale = Math.max(0.35, Math.min(3.5, scale * factor))
    panX = p.x - before.x * scale
    panY = p.y - before.y * scale
    draw()
  }

  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("pointermove", onPointerMove)
  canvas.addEventListener("pointerup", onPointerUp)
  canvas.addEventListener("pointercancel", onPointerUp)
  canvas.addEventListener("pointerleave", onPointerLeave)
  canvas.addEventListener("wheel", onWheel, { passive: false })

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleResize) : null
  ro?.observe(opts.parent)
  resize()

  return {
    destroy() {
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = 0
      ro?.disconnect()
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointercancel", onPointerUp)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      canvas.removeEventListener("wheel", onWheel)
      canvas.remove()
    },
    resize,
  }
}

function readColors(parent: HTMLElement): GraphColors {
  const styles = getComputedStyle(parent)
  const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    ink: css("--c-ink", "#1f2933"),
    paper: css("--c-paper", "#fffaf0"),
    petrol: css("--c-petrol", "#1f6f78"),
    ash: css("--c-ash", "#a8a29e"),
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}
