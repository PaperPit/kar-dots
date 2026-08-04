// ============================================================
// КАР-точки — минимальные графики без зависимостей (CSS-бары)
// ============================================================

import { el } from "../ui/ui.js"
import { formatPercent } from "./fsrs-optimize.js"

export interface Bar {
  label: string
  value: number
  title?: string
  accent?: boolean
}

/** Столбчатая диаграмма из div-баров (тема-адаптивная, отзывчивая). */
export function barChart(bars: Bar[], opts: { max?: number } = {}): HTMLElement {
  const peak = opts.max ?? Math.max(1, ...bars.map((b) => b.value))
  const cols = bars.map((b) => {
    const pct = peak > 0 ? (b.value / peak) * 100 : 0
    const fill = el("div", { class: "chart-bar-fill" + (b.accent ? " accent" : "") }, []) as HTMLElement
    fill.style.height = (b.value > 0 ? Math.max(4, Math.round(pct)) : 0) + "%"
    const bar = el(
      "div",
      { class: "chart-bar", title: b.title ?? b.label + ": " + b.value },
      [fill]
    )
    return el("div", { class: "chart-col" }, [bar, el("div", { class: "chart-xlabel" }, b.label)])
  })
  return el("div", { class: "chart-bars" }, cols)
}

/** Кольцевая диаграмма удержания (SVG). */
export function retentionRing(
  pct: number | null,
  opts: { size?: number; stroke?: number; label?: string } = {},
): HTMLElement {
  const size = opts.size ?? 120
  const stroke = opts.stroke ?? 10
  const r = Math.max(1, (size - stroke) / 2)
  const circumference = 2 * Math.PI * r
  const offset = pct != null ? circumference * (1 - pct) : circumference
  const pctText = pct != null ? Math.round(pct * 100) + "%" : "—"
  const label = opts.label ?? ""

  const svg = el("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: String(size),
    height: String(size),
    class: "retention-ring",
    "aria-label": label || `Retention: ${pctText}`,
    role: "img",
  }, [
    el("circle", {
      cx: String(size / 2),
      cy: String(size / 2),
      r: String(r),
      fill: "none",
      stroke: "var(--bg-sunken)",
      "stroke-width": String(stroke),
    }),
    el("circle", {
      cx: String(size / 2),
      cy: String(size / 2),
      r: String(r),
      fill: "none",
      stroke: "var(--accent)",
      "stroke-width": String(stroke),
      "stroke-dasharray": String(circumference),
      "stroke-dashoffset": String(offset),
      "stroke-linecap": "round",
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      class: "retention-ring-fill",
    }),
    el("text", {
      x: String(size / 2),
      y: String(size / 2 - 2),
      "text-anchor": "middle",
      "dominant-baseline": "central",
      class: "retention-ring-value",
    }, pctText),
    label
      ? el("text", {
          x: String(size / 2),
          y: String(size / 2 + stroke + 14),
          "text-anchor": "middle",
          class: "retention-ring-label",
        }, label)
      : null,
  ])

  return el("div", { class: "retention-ring-wrap" }, [svg])
}

/** Горизонтальная гистограмма удержания по алгоритму. */
export function algoRetentionBars(
  byAlgo: Record<string, { total: number; known: number; retention: number | null }>,
): HTMLElement {
  const entries = Object.entries(byAlgo)
  const colors: Record<string, string> = {
    sm2: 'var(--c-petrol)',
    fsrs: 'var(--c-ochre)',
    leitner: 'var(--c-moss)',
  }
  const labels: Record<string, string> = {
    sm2: 'SM-2',
    fsrs: 'FSRS',
    leitner: 'Leitner',
  }

  const rows = entries.map(([algo, data]) => {
    const pct = data.retention != null ? data.retention * 100 : 0
    const color = colors[algo] || 'var(--accent)'
    const label = labels[algo] || algo.toUpperCase()
    return el('div', { class: 'grade-dist-row' }, [
      el('span', { class: 'grade-dist-label' }, label),
      el('div', { class: 'grade-dist-track' }, [
        el('div', {
          class: 'grade-dist-fill',
          style: { width: pct > 0 ? Math.max(2, pct) + '%' : '0%', background: color },
        }),
      ]),
      el('span', { class: 'grade-dist-count tnum' }, formatPercent(data.retention)),
    ])
  })

  return el('div', { class: 'grade-dist' }, rows)
}
