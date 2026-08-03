/**
 * Простая force-layout для графа заметок (без d3).
 */

export interface LayoutNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  kind: "note" | "folder"
  title: string
  /** Memory-state заметки — для окраски узла. */
  memory?: "none" | "new" | "learning" | "rooted" | "fading"
}

export interface LayoutEdge {
  from: string
  to: string
  kind: "wiki" | "folder"
}

export function nodeDegrees(edges: { from: string; to: string }[]): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const e of edges) {
    degrees.set(e.from, (degrees.get(e.from) || 0) + 1)
    degrees.set(e.to, (degrees.get(e.to) || 0) + 1)
  }
  return degrees
}

export function layoutNoteGraph(
  nodesIn: { id: string; title: string; kind: "note" | "folder"; memory?: LayoutNode["memory"] }[],
  edgesIn: { from: string; to: string; kind: "wiki" | "folder" }[],
  width: number,
  height: number,
  steps = 80
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const cx = width / 2
  const cy = height / 2
  const nodes: LayoutNode[] = nodesIn.map((n, i) => {
    const a = (i / Math.max(nodesIn.length, 1)) * Math.PI * 2
    const r = Math.min(width, height) * 0.28
    return {
      id: n.id,
      title: n.title,
      kind: n.kind,
      memory: n.memory,
      x: cx + Math.cos(a) * r + (Math.random() - 0.5) * 8,
      y: cy + Math.sin(a) * r + (Math.random() - 0.5) * 8,
      vx: 0,
      vy: 0,
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges: LayoutEdge[] = edgesIn.filter((e) => byId.has(e.from) && byId.has(e.to))

  for (let step = 0; step < steps; step++) {
    const alpha = 1 - step / steps
    // отталкивание
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist2 = dx * dx + dy * dy || 0.01
        const dist = Math.sqrt(dist2)
        const force = (900 * alpha) / dist2
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
    }
    // пружины по рёбрам
    for (const e of edges) {
      const a = byId.get(e.from)!
      const b = byId.get(e.to)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const rest = e.kind === "folder" ? 90 : 120
      const f = ((dist - rest) * 0.04) * alpha
      const fx = (dx / dist) * f
      const fy = (dy / dist) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
    // к центру
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.01 * alpha
      n.vy += (cy - n.y) * 0.01 * alpha
      n.vx *= 0.85
      n.vy *= 0.85
      n.x += n.vx
      n.y += n.vy
      n.x = Math.max(40, Math.min(width - 40, n.x))
      n.y = Math.max(40, Math.min(height - 40, n.y))
    }
  }

  return { nodes, edges }
}
